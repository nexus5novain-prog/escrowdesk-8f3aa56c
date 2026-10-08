// Group escrow bot (hosted in the web app's Telegram webhook).
// Ported from the standalone Python bot; backed by public.tg_escrow_deals.
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tgCall, tgSendMessage } from "@/lib/telegram.server";

type Deal = {
  deal_id: string; creator_tg_id: number; group_id: number | null; group_link: string | null;
  buyer_tg_id: number | null; buyer_username: string | null; buyer_address: string | null;
  seller_tg_id: number | null; seller_username: string | null; seller_address: string | null;
  network: string | null; escrow_address: string | null; status: string;
  deposited_amount: number; txid: string | null;
};

const NETWORKS: Record<string, { label: string; env: string; explorer: (a: string) => string }> = {
  BTC: { label: "BTC", env: "ESCROW_WALLET_BTC", explorer: (a) => `https://mempool.space/address/${a}` },
  LTC: { label: "LTC", env: "ESCROW_WALLET_LTC", explorer: (a) => `https://litecoinspace.org/address/${a}` },
  TRC20: { label: "USDT (TRC20)", env: "ESCROW_WALLET_TRC20", explorer: (a) => `https://tronscan.org/#/address/${a}` },
};

const T = () => supabaseAdmin.from("tg_escrow_deals" as never) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const adminIds = () =>
  (process.env.TELEGRAM_ADMIN_IDS || "7371453715").split(",").map((s) => Number(s.trim())).filter(Boolean);
const isAdmin = (id: number) => adminIds().includes(id);
const support = () => process.env.SUPPORT_CONTACT || "@invisibleghostshell";
const walletFor = (n: string) => (process.env[NETWORKS[n]?.env ?? ""] || "").trim();
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const who = (u: { username?: string; first_name?: string }) => (u.username ? `@${u.username}` : esc(u.first_name || "user"));

async function byGroup(chatId: number): Promise<Deal | null> {
  const { data } = await T().select("*").eq("group_id", chatId).maybeSingle();
  return data as Deal | null;
}
async function upd(id: string, patch: Record<string, unknown>) {
  await T().update({ ...patch, updated_at: new Date().toISOString() }).eq("deal_id", id);
}

const roleKb = { inline_keyboard: [[{ text: "🛒 I'm the Buyer", callback_data: "g:role_buyer" }, { text: "💼 I'm the Seller", callback_data: "g:role_seller" }]] };
const actionsKb = { inline_keyboard: [
  [{ text: "✅ Release to Seller", callback_data: "g:pay" }, { text: "↩️ Refund Buyer", callback_data: "g:refund" }],
  [{ text: "📊 Balance", callback_data: "g:balance" }, { text: "📱 Address", callback_data: "g:qr" }],
  [{ text: "⚠️ Contact Support", callback_data: "g:contact" }],
] };
function networkKb() {
  const rows = Object.entries(NETWORKS).map(([k, v]) => [{ text: `${walletFor(k) ? "" : "⛔ "}${v.label}`, callback_data: `g:net_${k}` }]);
  return { inline_keyboard: rows };
}

const GROUP_CMDS = ["/start_deal", "/buyer", "/seller", "/confirm_deposit", "/pay_seller", "/release", "/refund_buyer", "/refund", "/balance", "/qr", "/contact", "/blockchain", "/deal"];

type Msg = { chat: { id: number; type: string; title?: string }; from: { id: number; username?: string; first_name?: string }; text?: string; forward_date?: number; forward_origin?: unknown; message_id: number; new_chat_members?: { id: number; is_bot?: boolean }[] };

/** Returns true when the update was handled by the group-escrow bot. */
export async function handleGroupEscrow(update: Record<string, unknown>): Promise<boolean> {
  const cb = update.callback_query as { id: string; data?: string; from: Msg["from"]; message?: Msg } | undefined;
  if (cb?.data?.startsWith("g:")) { await onCallback(cb); return true; }

  const m = update.message as Msg | undefined;
  if (!m?.from) return false;
  const text = (m.text || "").trim();
  const cmd = text.split(/\s+/)[0]?.toLowerCase().replace(/@\w+$/, "") || "";
  const inGroup = m.chat.type === "group" || m.chat.type === "supergroup";

  if (cmd === "/create") { await createDeal(m); return true; }
  if (!inGroup) return false;

  if (m.new_chat_members?.some((u) => u.is_bot)) {
    await tgSendMessage(m.chat.id, "👋 <b>EscrowDesk Bot</b> joined. Make me <b>admin</b>, then send <code>/start_deal DEAL_ID</code>.");
    return true;
  }
  if (m.forward_date || m.forward_origin) {
    if (await byGroup(m.chat.id)) {
      await tgCall("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id });
      await tgSendMessage(m.chat.id, "🚫 Forwards are blocked in escrow groups.");
      return true;
    }
    return false;
  }
  if (!GROUP_CMDS.includes(cmd)) return false;
  const args = text.split(/\s+/).slice(1);
  const send = (t: string, extra: Record<string, unknown> = {}) => tgSendMessage(m.chat.id, t, extra);

  if (cmd === "/start_deal") return startDeal(m, args[0]).then(() => true);
  const deal = await byGroup(m.chat.id);
  if (!deal) { await send("No active escrow in this group. Use /create in a private chat with me, then <code>/start_deal DEAL_ID</code> here."); return true; }

  switch (cmd) {
    case "/buyer": case "/seller":
      await setRole(m.chat.id, deal, cmd === "/buyer" ? "buyer" : "seller", m.from, args[0] || null); break;
    case "/confirm_deposit": await confirmDeposit(m, deal, args); break;
    case "/pay_seller": case "/release": await settle(m.chat.id, deal, "pay", m.from.id); break;
    case "/refund_buyer": case "/refund": await settle(m.chat.id, deal, "refund", m.from.id); break;
    case "/balance": case "/deal": await send(summary(deal)); break;
    case "/qr": case "/blockchain":
      await send(deal.escrow_address
        ? `📱 Escrow address:\n<code>${deal.escrow_address}</code>\n🔗 ${NETWORKS[deal.network!]?.explorer(deal.escrow_address) ?? ""}`
        : "No escrow address yet — pick a network first."); break;
    case "/contact": await send(`⚠️ <b>Support</b>\nMessage ${support()} — response within 24h.`); break;
  }
  return true;
}

function newId() { return randomBytes(4).toString("hex"); }

async function createDeal(m: Msg) {
  const id = newId();
  await T().insert({ deal_id: id, creator_tg_id: m.from.id, creator_username: m.from.username ?? null });
  const bot = process.env.TELEGRAM_BOT_USERNAME || "EscrowDeskBot";
  await tgSendMessage(m.chat.id,
    `⚡ <b>Escrow Deal Created</b>\n\nDeal ID: <code>${id}</code>\n\n` +
    `<b>Next steps:</b>\n1. Create a new private group\n2. Add <b>@${bot}</b> as administrator\n` +
    `3. In the group send:\n<code>/start_deal ${id}</code>\n\nThen invite the other party with the group link I post.`);
}

async function startDeal(m: Msg, idArg?: string) {
  const id = (idArg || "").toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(id)) return tgSendMessage(m.chat.id, "Usage: <code>/start_deal DEAL_ID</code>");
  const { data } = await T().select("*").eq("deal_id", id).maybeSingle();
  const deal = data as Deal | null;
  if (!deal) return tgSendMessage(m.chat.id, "❌ Deal ID not found. Use /create first.");
  if (deal.group_id && deal.group_id !== m.chat.id) return tgSendMessage(m.chat.id, "❌ This deal is already bound to another group.");
  if (deal.creator_tg_id !== m.from.id && !isAdmin(m.from.id)) return tgSendMessage(m.chat.id, "⛔ Only the deal creator can activate it.");
  const inv = await tgCall("exportChatInviteLink", { chat_id: m.chat.id });
  const link = typeof inv?.result === "string" ? inv.result : null;
  await upd(id, { group_id: m.chat.id, group_link: link, status: "waiting_roles" });
  await tgSendMessage(m.chat.id,
    `🔥 <b>EscrowDesk Bot</b>\n<i>Automated Telegram Escrow</i>\n\n✅ Escrow <b>#${id}</b> is active.\n` +
    (link ? `🔗 Group link: ${link}\n` : "⚠️ Make me admin so I can create an invite link.\n") +
    `\nRegister your role:\n<code>/seller YOUR_PAYOUT_ADDRESS</code>\n<code>/buyer YOUR_REFUND_ADDRESS</code>\nor tap a button.\n\n💡 BTC · LTC · USDT (TRC20)`,
    { reply_markup: roleKb });
}

async function setRole(chatId: number, deal: Deal, role: "buyer" | "seller", u: Msg["from"], address: string | null) {
  const cur = role === "buyer" ? deal.buyer_tg_id : deal.seller_tg_id;
  const other = role === "buyer" ? deal.seller_tg_id : deal.buyer_tg_id;
  if (cur && cur !== u.id) return tgSendMessage(chatId, `⛔ ${role} already taken.`);
  if (other === u.id) return tgSendMessage(chatId, "⛔ You can't be both buyer and seller.");
  if (!["created", "waiting_roles"].includes(deal.status) && !address) return tgSendMessage(chatId, "Roles are locked after the network is chosen.");
  const patch: Record<string, unknown> = { [`${role}_tg_id`]: u.id, [`${role}_username`]: u.username ?? u.first_name ?? null };
  if (address) patch[`${role}_address`] = address;
  await upd(deal.deal_id, patch);
  await tgSendMessage(chatId, `✅ ${who(u)} → <b>${role === "buyer" ? "Buyer 🛒" : "Seller 💼"}</b>` + (address ? `\nWallet: <code>${esc(address)}</code>` : ""));
  const both = role === "buyer" ? other : other; // other side id
  if (both && deal.status !== "waiting_deposit" && deal.status !== "funded") {
    await tgSendMessage(chatId, "🎉 Both roles set! Select network:", { reply_markup: networkKb() });
  }
}

async function chooseNetwork(chatId: number, deal: Deal, net: string, userId: number) {
  if (userId !== deal.buyer_tg_id && userId !== deal.seller_tg_id) return;
  if (!deal.buyer_tg_id || !deal.seller_tg_id) return tgSendMessage(chatId, "Both roles must be set first.");
  if (!["waiting_roles", "created"].includes(deal.status)) return tgSendMessage(chatId, "Network already chosen.");
  let addr = "";
  let invoiceId: string | null = null;
  if (net === "BTC") {
    // Unique per-deal address generated by the EscrowDesk BTCPay wallet; payment auto-confirms on-chain.
    try {
      const { createTgDealInvoice, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
      const inv = await createTgDealInvoice(deal.deal_id);
      invoiceId = inv.id;
      const pms = await getInvoicePaymentMethods(inv.id);
      addr = pms.find((p) => p.paymentMethod === "BTC-CHAIN" || p.paymentMethod === "BTC")?.destination ?? "";
    } catch (e) {
      console.error("[tg-escrow] BTC address generation failed", e);
    }
  } else {
    addr = walletFor(net);
  }
  if (!addr) return tgSendMessage(chatId, `⛔ <b>${NETWORKS[net]?.label ?? net}</b> deposits are not enabled yet. Choose another network or contact ${support()}.`);
  await upd(deal.deal_id, { network: net, escrow_address: addr, status: "waiting_deposit", btcpay_invoice_id: invoiceId });
  await tgSendMessage(chatId,
    `🌐 Network: <b>${NETWORKS[net].label}</b>\n\n🏦 <b>Buyer, send funds to the EscrowDesk address:</b>\n<code>${addr}</code>\n\n` +
    `Reference: <b>#${deal.deal_id}</b>\nAn admin verifies the payment on-chain and confirms it here.`,
    { reply_markup: actionsKb });
  for (const a of adminIds()) await tgSendMessage(a, `🆕 Deal #${deal.deal_id} awaiting ${NETWORKS[net].label} deposit to <code>${addr}</code>. Confirm in the group with <code>/confirm_deposit AMOUNT TXID</code>.`);
}

async function confirmDeposit(m: Msg, deal: Deal, args: string[]) {
  if (!isAdmin(m.from.id)) return tgSendMessage(m.chat.id, "⛔ Admins only.");
  if (deal.status !== "waiting_deposit") return tgSendMessage(m.chat.id, "This deal is not waiting for a deposit.");
  const amount = Number(args[0]); const txid = args[1];
  if (!(amount > 0) || !txid) return tgSendMessage(m.chat.id, "Usage: <code>/confirm_deposit AMOUNT TXID</code>");
  await upd(deal.deal_id, { status: "funded", deposited_amount: amount, txid, funded_at: new Date().toISOString() });
  const net = NETWORKS[deal.network!];
  await tgSendMessage(m.chat.id,
    `✅ <b>Deposit confirmed</b>\nAmount: <b>${amount} ${net.label}</b>\nTX: <code>${esc(txid)}</code>\n\nBuyer: release with /pay_seller once you receive what you paid for.`,
    { reply_markup: actionsKb });
  const ch = process.env.DEALS_CHANNEL_ID;
  if (ch) {
    await tgSendMessage(ch,
      `🔒 <b>New Funded Escrow #${deal.deal_id}</b>\n\n` +
      `🛒 Buyer: ${deal.buyer_username ? "@" + esc(deal.buyer_username) : "—"}\n` +
      `💼 Seller: ${deal.seller_username ? "@" + esc(deal.seller_username) : "—"}\n` +
      `🌐 Network: ${net.label}\n💰 Amount: <b>${amount}</b>\n` +
      `🏦 EscrowDesk wallet: <code>${deal.escrow_address}</code>\n🔗 ${net.explorer(deal.escrow_address!)}\n` +
      `🧾 TX: <code>${esc(txid)}</code>\n\nStatus: <b>FUNDED</b> ✅`);
  }
}

async function settle(chatId: number, deal: Deal, action: "pay" | "refund", userId: number) {
  if (deal.status !== "funded") return tgSendMessage(chatId, "Deal is not funded yet.");
  if (action === "pay" && userId !== deal.buyer_tg_id && !isAdmin(userId)) return tgSendMessage(chatId, "⛔ Only the buyer can release funds to the seller.");
  if (action === "refund" && userId !== deal.seller_tg_id && !isAdmin(userId)) return tgSendMessage(chatId, "⛔ Only the seller or an admin can refund the buyer.");
  const to = action === "pay" ? deal.seller_address : deal.buyer_address;
  await upd(deal.deal_id, { status: action === "pay" ? "completed" : "refunded", completed_at: new Date().toISOString() });
  await tgSendMessage(chatId, action === "pay"
    ? `✅ <b>Release approved.</b> Payout to seller wallet <code>${esc(to || "not set — seller, send /seller ADDRESS")}</code> is being sent by EscrowDesk.`
    : `↩️ <b>Refund approved.</b> Payout to buyer wallet <code>${esc(to || "not set — buyer, send /buyer ADDRESS")}</code> is being sent by EscrowDesk.`);
  for (const a of adminIds()) await tgSendMessage(a, `💸 Payout needed for #${deal.deal_id} (${action}) — ${deal.deposited_amount} ${deal.network} → <code>${esc(to || "address missing")}</code>`);
  const ch = process.env.DEALS_CHANNEL_ID;
  if (ch) await tgSendMessage(ch, `${action === "pay" ? "🎉 Completed" : "↩️ Refunded"} Escrow #${deal.deal_id} — ${deal.deposited_amount} ${deal.network}`);
}

function summary(d: Deal) {
  return `📊 <b>Escrow #${d.deal_id}</b>\nStatus: <b>${d.status.toUpperCase()}</b>\n` +
    `Buyer: ${d.buyer_username ? "@" + esc(d.buyer_username) : "—"}\nSeller: ${d.seller_username ? "@" + esc(d.seller_username) : "—"}\n` +
    `Network: ${d.network ? NETWORKS[d.network]?.label : "—"}\nDeposited: <b>${d.deposited_amount}</b>\n` +
    `Address: <code>${d.escrow_address || "N/A"}</code>`;
}

async function onCallback(cb: { id: string; data?: string; from: Msg["from"]; message?: Msg }) {
  await tgCall("answerCallbackQuery", { callback_query_id: cb.id });
  const chatId = cb.message?.chat.id; if (!chatId) return;
  const a = cb.data!.slice(2);
  const deal = await byGroup(chatId);
  if (!deal) return tgSendMessage(chatId, "No active escrow in this group.");
  if (a === "role_buyer" || a === "role_seller") return setRole(chatId, deal, a === "role_buyer" ? "buyer" : "seller", cb.from, null);
  if (a.startsWith("net_")) return chooseNetwork(chatId, deal, a.slice(4), cb.from.id);
  if (a === "pay" || a === "refund") return settle(chatId, deal, a, cb.from.id);
  if (a === "balance") return tgSendMessage(chatId, summary(deal));
  if (a === "qr") return tgSendMessage(chatId, deal.escrow_address ? `📱 <code>${deal.escrow_address}</code>` : "No address yet.");
  if (a === "contact") return tgSendMessage(chatId, `⚠️ Message ${support()} — response within 24h.`);
}
