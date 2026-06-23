## Scope

Three independent workstreams. Given the size, I'll ship in 4 phases — each phase is a usable milestone you can review before the next starts.

---

### Phase 1 — BTC-only conversion (destructive)

Goal: remove USDT / USDC / ETH everywhere.

**DB migration**
- Drop non-BTC rows from `wallets`, `wallet_transactions`, `offers`, `trades`, `escrow_groups`.
- Drop columns `wallet_address_usdt`, `wallet_address_usdc`, `wallet_address_usdc_chain`, `wallet_address_eth` from `profiles`.
- Narrow `asset_type` enum to `'BTC'` only (recreate enum, recast columns).
- Update `handle_new_user()` to seed only a BTC wallet.
- Update `get_my_private_profile()` to drop removed columns.

**Frontend**
- Wallet, deposit, withdraw, escrow.new, post-offer, settings → asset selectors hardcoded to BTC, multi-coin UI removed.
- Server fns validating `asset` reject anything other than `'BTC'`.

---

### Phase 2 — Order-book "Top Authors" tab + realtime category feed

**Authors tab (first tab in order-book)**
- New server fn `listTopAuthors` aggregating `listings` per `user_id`, joining `profiles` for badges/rating/trades/volume.
- Rank = same `computeThreadRank` composite applied per-user (tier-boost + avg rating + trades + freshness of newest thread).
- UI card per author: avatar, display_name, premium/trusted badge, ★ rating, trades count, BTC volume, active-thread count.

**Realtime category feed**
- Below tabs: live list of threads for the selected category with columns `thread | category | price | status | posted`.
- Supabase Realtime subscription on `listings` (filter by category client-side), `INSERT`/`UPDATE`/`DELETE` patches the React-Query cache.
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;` + ensure replica identity full.

---

### Phase 3 — Arbitration core (data + roles + evidence + timeline)

**New roles** added to `app_role` enum: `support`, `mediator`, `senior_arbitrator`, `super_admin` (admin / moderator / judge / finance already exist).

**New tables** (all with GRANTs, RLS, policies via `has_role` / `is_staff`):
- `arbitration_cases` — case_id (`ESC-DSP-YYYY-NNNNNN`), trade_id/escrow_group_id, buyer_id, seller_id, status (`open|evidence|under_review|awaiting_decision|appealed|resolved|closed`), severity, value_usd, opened_by, assigned_mediator_id, assigned_arbitrator_id, outcome, outcome_split jsonb, frozen_at, resolved_at.
- `arbitration_evidence` — case_id, uploader_id, kind (`image|document|comm|blockchain|video`), file_path (storage), sha256, size, mime, caption, is_confidential.
- `arbitration_timeline` — case_id, actor_id, actor_role, event, payload jsonb (append-only; no UPDATE/DELETE policy).
- `arbitration_notes` — case_id, staff_id, role, body (staff-only RLS).
- `arbitration_messages` — case_id, sender_id, body, visible_to (`all|staff`).
- `arbitration_appeals` — case_id, requested_by, reason, new_evidence_ref, status, reviewed_by, decision_note.
- `arbitration_audit_log` — global, append-only.

**Storage bucket** `arbitration-evidence` (private, authenticated SELECT, server-side write only). Hash computed server-side on upload-finalize.

**Server fns** (`src/lib/arbitration.functions.ts`):
- `openCase`, `uploadEvidence` (returns signed-upload URL + finalizes hash), `listMyCases`, `getCase` (role-aware payload — buyer/seller redacted from confidential evidence + notes).
- Staff: `assignMediator` (workload + conflict-of-interest check vs party history), `setStatus`, `addInternalNote`, `recommendOutcome`.
- Senior arbitrator: `ruleCase` with outcome enum + split — triggers fund movement via existing wallet RPCs; gated by value tier (≥$5k single SA, ≥$25k two SA, ≥$100k multi-sig table `arbitration_signoffs`).

**Auto-freeze**: opening a case sets parent trade/escrow_group to `disputed`, locks withdrawals (already enforced on `disputed` in existing RPCs).

---

### Phase 4 — Arbitration UI + fraud + notifications + exports

**User-facing**
- `/disputes` route (under `_authenticated/`): list of my cases + open-dispute form from a trade/escrow.
- `/disputes/$id`: timeline, evidence vault (drag-drop upload), message thread, appeal button when eligible.

**Staff dashboard** (`/admin` → new "Arbitration" tab)
- Sub-tabs: Open Cases / Pending Evidence / Pending Decisions / High-Risk / Escrow Balances / Analytics.
- Mediator/arbitrator assignment UI, internal notes panel, decision form (release-seller / refund-buyer / partial-% / request-evidence / negotiated), appeal review.

**Fraud signals** (background view + flags column):
- Shared IP / device fingerprint across parties (uses existing audit-log IPs).
- Repeated disputes per user (count last 90 days).
- Duplicate evidence sha256 across cases.
- Surface in High-Risk tab.

**Notifications**: in-app toasts + reuse existing Telegram bot helper for "dispute opened / mediator assigned / decision issued / appeal received". Email + SMS deferred unless you want them wired (no SMS provider configured).

**Exports**: server fn `exportCaseReport(caseId, format)` → PDF (via `pdf-lib` — Worker-safe), CSV, XLSX (via `xlsxwriter`-equivalent JS lib). Includes case summary, evidence index with hashes, timeline, decision, audit log.

---

## Technical notes

- All new server fns are `createServerFn` with `requireSupabaseAuth` + per-role checks via `has_role` / `is_staff`. Privileged operations load `supabaseAdmin` inside the handler.
- Multi-sig high-value rule lives in `arbitration_signoffs` table (case_id, signer_id, approved_at); `ruleCase` checks signoff count against tier threshold before executing.
- Audit log writes are triggered from each privileged RPC, not from client.
- Timeline + audit are append-only via RLS (no UPDATE/DELETE policy, no grants for those verbs).
- Evidence hash: SHA-256 of file bytes stored at finalize time; immutable after that.

## What you get when

1. Phase 1 merged → app is BTC-only end-to-end.
2. Phase 2 merged → order-book has Top Authors tab and live category feed.
3. Phase 3 merged → arbitration backend functional via API (no UI yet, testable from admin).
4. Phase 4 merged → full arbitration UI + fraud + notifications + exports.

Reply "go phase 1" (or any phase number) to start. I'll execute one phase per turn so each migration and UI batch stays reviewable.
