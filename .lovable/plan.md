# Phase 3 — Telegram as a first-class mobile client

Four streams shipped together. All sensitive actions reuse the Phase-2
TOTP gate (`consumeTotp`) — no new auth model. Everything still lives in
`src/routes/api/public/telegram/webhook.ts` plus a few small helpers; no
new tables for streams 1–3, two small tables for stream 4.

## 1. Inline trade actions (buttons on notifications)

When `notify.server.ts` pushes a trade event to Telegram, also send an
inline keyboard scoped to that trade + recipient role:

- Buyer (status=`pending_payment`): **I've paid** · **Open dispute**
- Seller (status=`paid`): **Release funds** · **Open dispute**
- Either (status=`awaiting_seller_confirm`, seller): **Confirm deposit**

Callback data is short and signed:

```
v1|<action>|<trade_short_id>|<sig8>
```

- `action` ∈ `paid | release | confirm | dispute`
- `trade_short_id` = first 8 chars of trade uuid
- `sig8` = first 8 chars of `hmac_sha256(TELEGRAM_API_KEY, action|trade|user)`
  → prevents another user from replaying buttons forwarded to them.

Handler (`answerCallbackQuery` + edit message):
1. Verify `sig8`, resolve full trade id, check the caller is the right
   party for the action.
2. If action ∈ {release, confirm, dispute}: reply with a force-reply
   prompt asking for the TOTP (`Reply with your 6-digit code`). The
   subsequent message is matched by `reply_to_message.message_id` and
   runs the existing `consumeTotp` + RPC path.
3. `paid` action runs `mark_trade_paid` straight away (already
   non-fund-moving in Phase 2).
4. On success, edit the original notification text to append
   `✅ Released by you at 12:34 UTC` etc., remove the keyboard.

## 2. Admin console commands

New staff-only command surface (gated by `is_staff(auth.uid())`, already in
DB). All write commands take a trailing TOTP like Phase 2.

- `/pending` — top 10 open disputes / withdrawals awaiting approval,
  each with inline **Open** button that deep-links to
  `escrowdesk.lovable.app/disputes/<id>` and a `/case <short>` shortcut.
- `/case <id>` — case summary: parties, value, age, last 3 messages.
- `/assign <id> <code>` — claims a dispute (sets `assigned_to`).
- `/resolve <id> buyer|seller <code>` — runs `resolve_dispute` RPC.
- `/approve <withdrawal_short> <code>` — `admin_approve_withdrawal`.
- `/reject  <withdrawal_short> reason <code>` — `admin_reject_withdrawal`.
- `/stats` — 24h counters: trades opened, released, disputed,
  withdrawals approved, drift count (from `reconciliation_runs`).

Each write command writes `user_security_events(kind='tg_admin_*')`
with the resolved entity id.

## 3. Group / escrow chat bridge

For every active trade, mirror `trade_messages` ↔ a private Telegram
thread between the two parties (and arbiter when assigned).

- Web → Telegram: extend `notify.server.ts` so that on
  `trade_message:insert` (non-system, non-bridge), each other
  participant who linked Telegram gets the body as a regular
  `sendMessage` with a `[T]` prefix and inline **Reply** that triggers
  force-reply.
- Telegram → web: when bot receives a force-reply matching a tracked
  trade prompt (`reply_to_message.message_id` keyed in
  `tg_pending_prompts` jsonb on `profiles`, no new table), insert into
  `trade_messages(sender_id, trade_id, body, is_system=false)` after a
  ban check.
- Attachments: photo/document → call `getFile` → upload to existing
  `trade-evidence` Supabase Storage bucket → attach link in the
  inserted message. No new schema; reuses bucket from disputes.
- No history sync: only messages from the moment both sides have
  linked Telegram are mirrored.

## 4. Deposit / withdraw flows

Reuse existing `deposit_requests` + `withdrawal_requests` RPCs. Two
small migrations:

```sql
-- Track which Telegram message owns a pending request, so we can edit
-- the message in place when status changes (paid/expired/rejected).
alter table public.deposit_requests
  add column tg_chat_id    bigint,
  add column tg_message_id bigint;

alter table public.withdrawal_requests
  add column tg_chat_id    bigint,
  add column tg_message_id bigint;

-- Per-user daily withdraw cap when initiated from Telegram. Defaults via
-- platform_settings('tg_withdraw_daily_cap_sats'); per-user override here.
alter table public.profiles
  add column tg_withdraw_daily_cap_sats bigint;
```

Bot:
- `/deposit [amount_btc]` — creates a `deposit_requests` row via existing
  `createDepositInvoice` server fn, replies with BTCPay address +
  amount + QR (rendered server-side as PNG via existing `qrcode`
  package, sent as photo). Edits message on settle.
- `/withdraw <btc_address> <amount_btc> <code>` — TOTP-gated, validates
  address (bech32/legacy regex), enforces daily cap, creates
  `withdrawal_requests` in `pending_review`, replies with the request
  id and the standard "awaiting admin approval" copy. Status changes
  edit the message.
- `/cancelwithdraw <short> <code>` — sets status `cancelled` via existing
  `cancel_withdrawal_request` server fn (TOTP-gated) while still in
  `pending_review`.

Out of scope:
- Address book / saved payout addresses.
- Lightning invoices from Telegram (`/deposit` is on-chain only).
- Pushing balance changes proactively without an explicit command (the
  existing `wallet_credited` notification kind already covers it).

## File map

- `src/routes/api/public/telegram/webhook.ts` — add `callback_query`
  handler, force-reply tracker, inline-keyboard builders, new command
  parsers. Stays under ~1.2k LOC; extract pure helpers to
  `src/lib/telegram/*.ts`:
  - `keyboards.ts` (button builders + `sign/verify` for callback data)
  - `commands/admin.ts`, `commands/wallet.ts`
  - `bridge.ts` (force-reply tracking, trade-message mirroring)
- `src/lib/notify.server.ts` — when sending Telegram, also attach the
  right keyboard via new `tgSendMessage(..., reply_markup)`.
- `supabase/migrations/…_phase3_telegram.sql` — the two `alter table`s
  above + a tiny `tg_pending_prompts jsonb` column on `profiles`.

## Verification

1. Build passes; types regenerated for the three new columns.
2. Open a trade as buyer on web → Telegram notification shows
   **I've paid** button → tap → trade flips to `paid`, message edits.
3. As seller, tap **Release** → bot force-replies for TOTP → reply
   with 6 digits → release runs, message edits to ✅.
4. As admin, `/pending` lists open disputes, `/resolve <id> buyer 123456`
   resolves it; security event row written.
5. Mirror: from Telegram, reply to a `[T] <buyer message>` line —
   appears in the web trade chat under your name.
6. `/deposit 0.001` returns address + QR; settling it on BTCPay edits
   the message to "✅ 0.001 BTC credited".
7. `/withdraw bc1q… 0.0005 123456` creates a `pending_review`
   withdrawal visible in the admin queue; bot blocks a second
   withdraw that would exceed the daily cap.
