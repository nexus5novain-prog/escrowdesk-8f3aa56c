# EscrowDesk — Ledger-First Refactor (5 Phases)

This is a multi-week refactor. I'll ship one phase per turn so you can verify each before the next. Below is the full scope so we agree on the end state, then I'll start Phase 1 immediately on your "go".

---

## Phase 1 — Ledger becomes the single source of truth (CRITICAL)

**Migration**
- Add `migrations/…_ledger_takeover.sql`:
  1. **Backfill**: for each existing `wallets` row, insert a synthetic `ledger_entries` row crediting `available` (and `locked_escrow` from `wallets.escrow`) from `wallet_transactions` history where available, else a single `migration_seed` entry equal to the current balance. Source `kind` from the transaction's original kind.
  2. **Reconciliation check**: assert `v_wallet_balances.available_sats = wallets.available * 1e8` and `locked_escrow_sats = wallets.escrow * 1e8` for every user. Migration FAILS LOUDLY if any row mismatches.
  3. Rewrite `start_trade`, `release_trade`, `cancel_trade`, `resolve_dispute`, `credit_wallet`, `debit_wallet`, `confirm_buyer_deposit`, `mark_trade_paid` to call `ledger_debit` / `ledger_credit` / `ledger_transfer_bucket` / `ledger_transfer_user` instead of touching `wallets`.
  4. Fees: debit buyer `locked_escrow`, credit a platform fee wallet (`user_wallets` row with sentinel `user_id`), credit seller `available` (net).
  5. Mark `wallets` and `wallet_transactions` read-only via `REVOKE INSERT, UPDATE, DELETE` from `authenticated`, then drop write paths from RPC functions. Keep them around for 1 release as a read-only audit cache.

**App code**
- Update `escrow.functions.ts`, `trades.tsx`, `escrow.$id.tsx`, `arbitration.functions.ts`, any place reading `wallets.available/escrow` → read from `v_wallet_balances`.
- Delete `LivePortfolio` treasury widget from user surfaces (Phase 5 will reuse the design on the public Portfolio page).

## Phase 2 — Admin withdrawal approval

- New `/admin/withdrawals` page: tabs `Pending review` / `Approved` / `Rejected` / `Paid out` with risk score, destination preview, user trust badges, KYC status.
- Server fns: `adminListWithdrawals`, `adminApproveWithdrawal` (single-admin for $500–$2k, **two-admin** for ≥$2k via `withdrawal_approvals` join table), `adminRejectWithdrawal` (refunds `pending_withdrawal → available`), `adminMarkPaid` (debits `pending_withdrawal`, stores `tx_hash`/`payment_hash`).
- Migration: add `withdrawal_approvals(withdrawal_id, admin_id, action, note)`, immutable. Every action writes `wallet_audit_log`.
- Hard rule: no `withdrawal_request.status = approved → paid` transition without ≥1 (or ≥2) admin approval rows. Enforced in trigger.

## Phase 3 — Settings dashboard rebuild

`/settings` becomes a tabbed shell with sections: Profile · Security (password, 2FA, withdrawal PIN) · Identity (KYC) · Wallet preferences (default payout method, BTC address, LN node) · Notifications · Privacy · Sessions · API tokens · Login history · Security events · Activity · Trusted devices · Withdrawal security (per-tx limit, daily limit, IP allowlist, withdrawal cooldown).

Tables added: `user_sessions`, `user_api_tokens`, `user_security_events`, `user_trusted_devices`, `user_withdrawal_policy`. All realtime-subscribed via `postgres_changes`.

## Phase 4 — Wallet hardening

- Webhook: add `btcpay_webhook_deliveries(event_id PK, …)` for idempotency — replay returns 200 without re-crediting.
- Constant-time HMAC compare (already in place, verify).
- LN-only invoices reject if BTCPay reports payment outside expiration window.
- Reconciliation job (`/api/public/cron/reconcile`, secured with `CRON_SECRET`): compares per-user ledger totals to BTCPay store balance + LND channel balances; writes `reconciliation_reports` and emits a `notify_user` to admins on drift > 1000 sats.
- Withdrawal: enforce `user_withdrawal_policy` limits before locking funds.

## Phase 5 — Portfolio ↔ Escrow split

- `/escrow-portfolio` (already an About page) gets the full design treatment: animated escrow flow, buyer/seller protection cards, dispute resolution explainer, live platform stats (total trades, total volume, dispute resolution time — all from the ledger), trust & transparency panel.
- `/wallet` stays the operational dashboard (already custodial).
- `/escrow/new` and `/escrow/$id` get a compact ledger-fed balance strip.

---

## Recommendation

Start with **Phase 1** — the dual-ledger accounting risk is the most serious problem on the list and blocks everything else. I'll write the migration and the rewritten SQL functions, run the backfill + reconciliation in the same migration so it aborts on any mismatch, and then update the app code in a follow-up turn once the migration is approved.

Reply **"go"** and I'll write the Phase 1 migration now. If you want to adjust thresholds (admin approval at $500 single / $2000 dual?) or scope, say so in the same reply.
