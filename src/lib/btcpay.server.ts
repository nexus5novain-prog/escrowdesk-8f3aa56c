// BTCPay Server Greenfield API wrapper — server-only. Never import from client.
// Treasury wallets, API keys, and webhook secret stay here.

export type BTCPayInvoice = {
  id: string;
  checkoutLink?: string;
  amount?: string;
  status?: string;
  expirationTime?: number;
  metadata?: Record<string, unknown>;
};

export type BTCPayPaymentMethod = {
  paymentMethod: string; // e.g. "BTC-CHAIN", "BTC-LN"
  destination?: string;  // address or bolt11
  amount?: string;
  rate?: string;
  paymentMethodPaid?: string;
  totalPaid?: string;
  due?: string;
  paymentLink?: string;
  payments?: Array<{ id?: string; confirmations?: number; receivedDate?: number }>;
};

function env() {
  const url = process.env.BTCPAY_URL;
  const key = process.env.BTCPAY_API_KEY;
  const store = process.env.BTCPAY_STORE_ID;
  if (!url || !key || !store) {
    throw new Error("BTCPay not configured: set BTCPAY_URL, BTCPAY_API_KEY, BTCPAY_STORE_ID");
  }
  return { url: url.replace(/\/$/, ""), key, store };
}

async function btcpay<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = env();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${key}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    console.error(`[btcpay] ${path} ${res.status}`, body);
    throw new Error(`BTCPay ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body as T;
}

export async function createInvoice(args: {
  amountBtc: number;
  tradeId: string;
  buyerId: string;
  expirySeconds?: number;
}): Promise<BTCPayInvoice> {
  const { store } = env();
  return btcpay<BTCPayInvoice>(`/api/v1/stores/${store}/invoices`, {
    method: "POST",
    body: JSON.stringify({
      amount: args.amountBtc.toFixed(8),
      currency: "BTC",
      metadata: {
        tradeId: args.tradeId,
        buyerId: args.buyerId,
        orderId: `ESC-${args.tradeId.slice(0, 8).toUpperCase()}`,
      },
      checkout: {
        expirationMinutes: Math.round((args.expirySeconds ?? 60 * 60) / 60),
        speedPolicy: "MediumSpeed", // 1 conf = processing, 3 confs unused (Settled fires on broadcast); we track confs ourselves
        paymentMethods: ["BTC-CHAIN", "BTC-LN"],
      },
    }),
  });
}

export async function createDepositInvoice(args: {
  amountBtc: number;
  userId: string;
  walletId: string;
  expirySeconds?: number;
}): Promise<BTCPayInvoice> {
  const { store } = env();
  return btcpay<BTCPayInvoice>(`/api/v1/stores/${store}/invoices`, {
    method: "POST",
    body: JSON.stringify({
      amount: args.amountBtc.toFixed(8),
      currency: "BTC",
      metadata: {
        depositType: "btc_onchain",
        userId: args.userId,
        walletId: args.walletId,
        orderId: `DEP-${args.userId.slice(0, 8).toUpperCase()}-${Date.now()}`,
      },
      checkout: {
        expirationMinutes: Math.round((args.expirySeconds ?? 60 * 60) / 60),
        speedPolicy: "MediumSpeed",
        paymentMethods: ["BTC-CHAIN"],
      },
    }),
  });
}

/** Amount-less (top-up) invoice: gives a fresh on-chain address for one Telegram escrow deal. */
export async function createTgDealInvoice(dealId: string): Promise<BTCPayInvoice> {
  const { store } = env();
  return btcpay<BTCPayInvoice>(`/api/v1/stores/${store}/invoices`, {
    method: "POST",
    body: JSON.stringify({
      currency: "BTC",
      metadata: { tgDealId: dealId, orderId: `TG-${dealId.toUpperCase()}` },
      checkout: { expirationMinutes: 60 * 24 * 7, speedPolicy: "MediumSpeed", paymentMethods: ["BTC-CHAIN"] },
    }),
  });
}

export async function getInvoice(invoiceId: string): Promise<BTCPayInvoice> {
  const { store } = env();
  return btcpay<BTCPayInvoice>(`/api/v1/stores/${store}/invoices/${invoiceId}`);
}

export async function getInvoicePaymentMethods(invoiceId: string): Promise<BTCPayPaymentMethod[]> {
  const { store } = env();
  return btcpay<BTCPayPaymentMethod[]>(`/api/v1/stores/${store}/invoices/${invoiceId}/payment-methods`);
}

export async function createPullPayment(args: {
  name: string;
  amountBtc: number;
  destination: string;
}) {
  const { store } = env();
  // BTCPay pull-payment approach: create a pull payment, then approve a payout.
  // For simpler direct sends, use Lightning sendpayment via LND macaroon — not available via Greenfield key alone.
  return btcpay<{ id: string }>(`/api/v1/stores/${store}/pull-payments`, {
    method: "POST",
    body: JSON.stringify({
      name: args.name,
      amount: args.amountBtc.toFixed(8),
      currency: "BTC",
      payoutMethods: ["BTC-CHAIN"],
    }),
  });
}

export function verifyWebhookSignature(rawBody: string, headerSig: string | null): boolean {
  if (!headerSig) return false;
  const secret = process.env.BTCPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(headerSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
