# Plan: Threads management, ban enforcement, profile filters, order-book recognition, nav move

Six related changes, grouped so each ships verifiable end-to-end.

## 1. `/my-threads` — author self-service page

New route `src/routes/my-threads.tsx` under the `_authenticated` umbrella (gated; sign-in required to manage own posts). Added to the header right after **P2P Order-book** as a sub-link, plus mobile nav entry.

- Server fn `listMyThreads` (in `marketplace.functions.ts`, `requireSupabaseAuth`) returns every listing where `author_id = userId` regardless of status, with counts (views, offers if available).
- Server fns `updateMyThread` (title, body, price, category, status toggle active/paused) and `deleteMyThread` (soft → `status='deleted'`).
- UI: table with inline edit dialog (reusing existing `PostListing` form fields), delete confirm, status pill, "view public" link.

## 2. Ban enforcement (site-wide + admin multi-select)

### DB migration
- `listings` policies: replace the existing INSERT policy with one that also requires `NOT public.is_user_banned(auth.uid())`.
- Add `public.is_user_banned(uuid) returns boolean security definer` reading `profiles.is_banned`.
- `listCategoryThreads`, `listMyThreads`, `getPublicProfile`, `TopAuthors`: filter out rows where author `is_banned = true` for non-admins. Admin queries keep them but flag visually.

### Server fns
- `createListing` / `postListing` (and any other thread-create paths) call `is_user_banned` first → throw "Your account has been suspended".
- Extend `adminBanThreadAuthor` already exists; add `adminBulkAction({ userIds, action: 'ban'|'unban'|'suspend'|'delete' })`:
  - `ban` → `profiles.is_banned = true` + flip their listings to `inactive`.
  - `unban` → `is_banned = false`.
  - `suspend` → `profiles.suspended_until = now() + interval` (new column).
  - `delete` → `auth.admin.deleteUser()` via supabaseAdmin loaded inside handler.

### Admin UI
New **Users** tab in `admin.tsx` (or extend existing Threads panel author column): paginated user table with checkboxes, search by display name / telegram / email, bulk action bar (Ban / Unban / Suspend 7d / Delete) with confirm dialog. Surface ban/suspend state in `ThreadsPanel` author cell.

DB migration adds `profiles.suspended_until timestamptz`.

## 3. Public profile `/u/$userId` — sort, filter, pagination

Update `src/routes/u.$userId.tsx`:
- URL search params via `validateSearch`: `sort` (`newest` | `active` | `pinned`), `kind` (`all` | `selling` | `seeking`), `page` (number, default 1, 10 per page).
- Extend `getPublicProfile` server fn to accept `{ userId, sort, kind, page, pageSize }` and return `{ threads, totalCount }`.
  - `newest` → `created_at DESC`
  - `active` → `last_bumped_at DESC NULLS LAST, created_at DESC`
  - `pinned` → `is_pinned DESC, created_at DESC`
- Controls row above thread list: sort `Select`, kind `Tabs`, prev/next pagination footer.

## 4. Order-book product cards — author recognition

In `src/routes/order-book.tsx` product/listing cards (and marketplace product cards if the same shape):
- Extend whichever server fn lists order-book entries to join `profiles` (avatar, display_name, is_premium, is_trusted, rating_sum, rating_count).
- Card footer adds: avatar (32px) + display name (link to `/u/$userId`) + trust icon + ★ rating (1 decimal) + "(N)" review count. Same treatment for Selling / Seeking / Services tabs.

## 5. Move Disputes under Trades

- New route file `src/routes/trades.disputes.tsx` and `trades.disputes.$id.tsx` (re-export the existing component bodies from `disputes.tsx` / `disputes.$id.tsx`).
- Convert `src/routes/trades.tsx` to a layout: render `<Outlet />` plus a sub-tab strip ("My Trades" → `/trades` index, "Disputes" → `/trades/disputes`). Move existing trades content to `trades.index.tsx`.
- Header: remove top-level **Disputes** link; it now lives inside Trades. Add 301-style redirect from old `/disputes` → `/trades/disputes` via a `beforeLoad` throw redirect on the old route file (keep file as redirect-only) so deep links still work.
- Mobile nav updated to match.

## 6. Verification

- `bun run build` (auto by harness).
- Playwright: open `/order-book`, confirm avatar + rating in card; click "My Threads" → listing shows my posts; admin → users tab → bulk ban → confirm author's listings disappear from public order-book; profile page sort/filter changes URL and reorders; `/disputes/abc` redirects to `/trades/disputes/abc`.

## Technical notes
- All new server fns gating writes call `is_user_banned` first.
- Listings query filter: `LEFT JOIN profiles … WHERE coalesce(profiles.is_banned,false) = false` on every public read.
- Migration order: add `is_user_banned` fn + `suspended_until` col + listings INSERT policy update in one migration; do code edits after approval.

Out of scope: shoutbox ban behavior, wallet/escrow changes, trade flow changes, new tables beyond column additions.
