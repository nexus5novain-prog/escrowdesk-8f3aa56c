## Scope (you picked)

Build **Phase 1: Bitcoin + Lightning escrow infrastructure** wired to a hosted BTCPay Server (Voltage / BTCPay Jungle / similar). Notifications and the wallet-portfolio redesign are **not** in this plan — we'll do those next once escrow infra is live.

## What you provide (one-time, via secure secrets prompt)

1. `BTCPAY_URL` — e.g. `https://mainnet.demo.btcpayserver.org`
2. `BTCPAY_API_KEY` — Greenfield API key with **store-level** permissions:
   `btcpay.store.canviewinvoices`, `btcpay.store.cancreateinvoice`, `btcpay.store.canmodifyinvoices`, `btcpay.store.canviewstoresettings`
3. `BTCPAY_STORE_ID` — the store that owns the on-chain wallet + LN node
4. `BTCPAY_WEBHOOK_SECRET` — generated automatically; you paste it into BTCPay → Store → Webhooks

I never see your seed phrase, LND macaroon, or treasury xpub — those stay inside BTCPay.

---

## Architecture

```text
 Buyer ──opens trade──▶ EscrowDesk
                          │
                          ├─ createServerFn: createEscrowInvoice(trade_id)
                          │     POST {BTCPAY_URL}/api/v1/stores/{store}/invoices
                          │     → unique BTC address + BOLT11 invoice
                          │
                          ▼
                  escrow_invoices table
                  (one row per trade, never reused)
                          │
 Buyer pays ──▶ BTCPay/LND detects payment
                          │
                          ▼
 BTCPay webhook ──▶ POST /api/public/hooks/btcpay
                    HMAC-SHA256 verify (BTCPAY_WEBHOOK_SECRET)
                          │
                          ▼
              update escrow_invoices.status
              update trades.status (paid → released flow)
              insert wallet_transactions
              insert escrow_events (audit log)
```

**No treasury address ever leaves the server.** Frontend only ever receives `{ bitcoin_address, lightning_invoice, amount_btc, expires_at, status }` for the current trade.

---

## Database (one migration)

```text
escrow_invoices
  id, trade_id (FK, unique), btcpay_invoice_id (unique),
  bitcoin_address, lightning_invoice, amount_btc,
  status (new|processing|settled|expired|invalid),
  confirmations (int), paid_amount_btc,
  expires_at, settled_at, created_at, updated_at

escrow_events  (audit log — append-only)
  id, trade_id, invoice_id, kind (created|detected|confirmed|settled|released|refunded|expired|webhook_received),
  payload (jsonb), created_at

payouts        (release + refund queue)
  id, trade_id, kind (release|refund), destination_address,
  amount_btc, status (pending|approved|broadcast|confirmed|failed),
  btcpay_payout_id, requested_by, approved_by, tx_hash, created_at, updated_at
```

All three: RLS on, GRANTs for `authenticated` (own rows via trade parties) + `service_role`, append-only policies on `escrow_events`. Admin-only read on `payouts`.

---

## Server functions (new file `src/lib/btcpay.functions.ts` + `btcpay.server.ts`)

- `createEscrowInvoice({ tradeId })` — auth'd participant; creates BTCPay invoice with `metadata.tradeId`, persists row, returns payment destinations. Idempotent (returns existing row if status is `new|processing`).
- `getEscrowInvoice({ tradeId })` — polls DB row (no BTCPay call); used by trade page.
- `refreshEscrowInvoice({ tradeId })` — manual GET against BTCPay for reconciliation.
- `requestPayout({ tradeId, kind, destination })` — admin/staff; creates `payouts` row, calls BTCPay Pull Payments API.
- `approvePayout({ payoutId })` — admin only (`has_role admin`); broadcasts.

All privileged calls use `requireSupabaseAuth` + `has_role` check. `btcpay.server.ts` holds the fetch wrapper, signs requests, never imported from client.

---

## Webhook endpoint

`src/routes/api/public/hooks/btcpay.ts` (POST, no auth header — verified by HMAC):

1. Read raw body, compute `HMAC-SHA256(body, BTCPAY_WEBHOOK_SECRET)`, timing-safe compare with `BTCPay-Sig` header.
2. Parse event type: `InvoiceCreated`, `InvoiceReceivedPayment`, `InvoiceProcessing` (1 conf), `InvoiceSettled` (fully paid), `InvoiceExpired`, `InvoiceInvalid`, `PayoutApproved`, `PayoutCompleted`.
3. Look up `escrow_invoices` by `btcpay_invoice_id`, update status + confirmations.
4. On `InvoiceSettled`: advance `trades.status` to `paid` (or `funded` for our awaiting_deposit flow), insert `escrow_events`, credit the existing `wallets.escrow` ledger.
5. Reply `200 { ok: true }` quickly; all work in a single transaction.

---

## Trade page UI changes (`src/routes/trade.$id.tsx`)

When `status = awaiting_deposit` and buyer is viewing:

- Tab switcher: **On-chain BTC** | **Lightning ⚡**
- On-chain panel: QR code of `bitcoin:<addr>?amount=<btc>`, copy button, "0/3 confirmations" live progress, expires-in timer.
- Lightning panel: QR of BOLT11, copy button, "Awaiting payment" → "Settled ✓".
- Polls `getEscrowInvoice` every 5s + subscribes to `escrow_invoices` realtime channel for instant updates.
- Auto-advances the trade view when webhook flips status.

Add `qrcode.react` (small dep, ~6KB).

---

## Confirmation rules (matches your spec)

- `InvoiceReceivedPayment` (0 conf) → trade row gets `payment_detected_at`, UI shows "Payment Detected"
- `InvoiceProcessing` (1 conf) → "Payment Detected, 1/3 confirmations"
- 3 confirmations (BTCPay default speed=medium) → `InvoiceSettled` → "Escrow Funded" → `trades.status = paid`
- Lightning: `InvoiceSettled` fires immediately on HTLC settle → instant funded

---

## Out of scope (deferred)

- Notifications (bell + Telegram push) — separate plan after this lands
- Wallet portfolio redesign with live BTC balance — separate plan
- USDT/USDC, multisig treasury, automated cold storage (your Phase 2-5)

---

## Files touched

**New:**
`supabase/migrations/<ts>_btcpay_escrow.sql`,
`src/lib/btcpay.server.ts`,
`src/lib/btcpay.functions.ts`,
`src/routes/api/public/hooks/btcpay.ts`,
`src/components/EscrowPaymentPanel.tsx`

**Edited:**
`src/routes/trade.$id.tsx` (mount payment panel),
`src/lib/escrow.functions.ts` (trigger invoice creation when trade reaches `awaiting_deposit`),
`src/integrations/supabase/types.ts` (regen after migration)

**Secrets requested:** `BTCPAY_URL`, `BTCPAY_API_KEY`, `BTCPAY_STORE_ID`, `BTCPAY_WEBHOOK_SECRET` (auto-generated, you paste into BTCPay UI).

Once you approve, I'll run the migration first, then build server + webhook + UI, then give you the exact webhook URL + secret to paste into your BTCPay store.