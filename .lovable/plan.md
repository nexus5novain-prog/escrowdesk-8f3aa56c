This is a large, multi-part request. Before I touch code, here is the plan I want your sign-off on. I'll break it into 4 shippable phases so we can verify each one before moving on.

---

## Context — what already exists

- `wallets` table with `available` / `escrow` per asset (BTC only).
- `wallet_transactions` (append-only) — already the basis of a ledger.
- `escrow.functions.ts` handles internal escrow lock/release through SECURITY DEFINER SQL functions (`start_trade`, `release_trade`, `cancel_trade`, etc.) — **internal escrow logic stays exactly as-is**.
- BTCPay server functions exist (`btcpay.functions.ts`, `btcpay.server.ts`, webhook at `/api/public/hooks/btcpay`) and currently mint **invoices for shoutout payments**.
- `LivePortfolio` component on `/wallet` shows live BTC/LN treasury balances (admin-style view leaked into user wallet).
- `/escrow/new` is currently crashing with "Failed to fetch dynamically imported module" — stale build, fixes itself on next deploy but I'll verify after Phase 1.

---

## Phase 1 — Fix the broken build + move portfolio to escrow page (small, fast)

1. Remove the leaked treasury `LivePortfolio` from `/wallet` (users should never see treasury balances per your security spec).
2. Build a new **"About Escrow" hero panel** on `/escrow/new` and `/escrow-portfolio`:
   - Animated mediator-bot lottie/particle hero
   - "What is EscrowDesk" / "How it works" / "Why it's safe" sections
   - Small live-balance strip (just the signed-in user's own internal wallet — Available / Locked / Pending) — NOT treasury data.
3. Keep existing escrow create/list logic untouched.
4. Re-verify `/escrow/new` loads after the rebuild.

## Phase 2 — Custodial ledger wallet (the big one)

### DB migration
- New table `user_wallets` — one row per user, human-readable `wallet_code` (`WAL-00012345`), created on signup via trigger.
- New table `ledger_entries` — **immutable, append-only**:
  `id, wallet_id, user_id, kind (enum), asset (btc|ln|fiat), amount_sat, direction (credit|debit), balance_bucket (available|locked_escrow|pending_deposit|pending_withdrawal), ref_type, ref_id, metadata jsonb, created_at`. No UPDATE/DELETE policies — service_role insert only.
- New table `deposit_requests` — `id, user_id, method (btc_onchain|lightning|flutterwave), btcpay_invoice_id, address_or_invoice, amount_sat, status, expires_at, confirmations`.
- New table `withdrawal_requests` — `id, user_id, method, destination, amount_sat, status, risk_score, approved_by, btcpay_payout_id, tx_hash`.
- New table `audit_log` — immutable, captures user_id, ip, ua, action, payload.
- View `v_wallet_balances` — computes Available / Locked / Pending Deposit / Pending Withdrawal / Total **from `ledger_entries` only**, never editable directly.
- SECURITY DEFINER RPCs: `ledger_credit`, `ledger_debit`, `ledger_transfer_bucket` — only way to mutate balances. All current `wallets`/`wallet_transactions` writes (in `start_trade`, `release_trade`, `cancel_trade`, `resolve_dispute`, `credit_wallet`, `debit_wallet`) get rewritten to call these.

### Server functions
- `getMyWallet` — returns wallet code + bucket balances from the view.
- `createBtcDepositAddress` — calls BTCPay `/stores/{id}/payment-methods/onchain/BTC/wallet/address` (or creates an invoice with on-chain rail), stores `deposit_request`.
- `createLightningInvoice` — calls BTCPay LN `/stores/{id}/lightning/BTC/invoices`, stores `deposit_request`.
- `requestBtcWithdrawal` / `requestLightningWithdrawal` — validates KYC/limits/2FA flag, creates `withdrawal_request` in `pending`. Large amounts require admin approval; small auto-payout via BTCPay payouts API / LN pay invoice.
- `fundEscrowFromWallet`, `releaseEscrowToWallet`, `refundEscrowToBuyer` — internal bucket transfers, no chain tx.

### Webhook
- Extend `/api/public/hooks/btcpay` to:
  - match `InvoiceSettled` against `deposit_requests` → `ledger_credit` to `available`, mark request `confirmed`.
  - match `InvoiceReceivedPayment` → mark `pending_deposit`, credit to `pending_deposit` bucket.
  - match payout webhooks → finalize withdrawal, debit `pending_withdrawal`.

### Realtime
- Wallet dashboard subscribes to `ledger_entries` filtered by `user_id` → balances refresh instantly (no polling).

## Phase 3 — Wallet & Settings UX

**New `/wallet` page (custodial dashboard):**
- Header: `WAL-00012345` · Total value · BTC/sats toggle.
- 4 balance cards: Available / Locked in Escrow / Pending Deposits / Pending Withdrawals.
- Tabs: Deposit (BTC address QR + LN invoice QR + Flutterwave) · Withdraw (BTC / LN / Flutterwave) · Activity (ledger feed, realtime).
- Charts: 30-day net flow, per-kind breakdown.

**Settings dashboard** (`/settings` rebuilt):
- Profile (display name, avatar, bio, country)
- Account security (email, password, 2FA toggle, active sessions, login history from audit log)
- KYC & verification (status, document upload, risk score)
- Wallet & payouts (default withdrawal method, BTC payout addr, LN node, Flutterwave bank)
- Notifications (existing in-app/telegram matrix, kept)
- Telegram link
- API keys (read-only personal token)
- Danger zone (close account)

Each section is its own card, all live-updated via supabase realtime on `profiles` / `user_roles` / `audit_log`.

## Phase 4 — Fraud / audit / Flutterwave

- Withdrawal risk scoring server fn (amount, age, prior chargebacks, IP velocity).
- Rate-limit table (ad-hoc, per your no-backend-rate-limiting rule — only after you confirm).
- Flutterwave connector wiring: deposit init, webhook verify, refund. Requires you to add `FLW_SECRET_KEY` / `FLW_PUBLIC_KEY` / `FLW_ENCRYPTION_KEY` via the secrets flow.
- Audit log viewer in admin panel.

---

## Open questions before I start

1. **Flutterwave secrets** — do you already have an account? I'll need you to paste 3 keys via the secure secrets form when we hit Phase 4. OK to defer that until Phase 1-3 are done?
2. **Wallet unit** — display in BTC, sats, or user-toggle? (I'd default to sats internally, BTC+USD on screen.)
3. **Withdrawal approval threshold** — what USD amount triggers manual admin approval? (Default suggestion: anything ≥ $500.)
4. **Existing `wallets` table** — keep as a cached projection of the ledger (faster reads), or drop it entirely and always read from the view? Recommendation: keep as cache, rebuilt by trigger on `ledger_entries` insert.

Reply with answers (or "go" to take my defaults) and I'll start with Phase 1 immediately — that's the one that unblocks the broken `/escrow/new` page you're staring at right now.