## Goal
Make thread (listing) authors visibly recognizable, keep the threads listing live across the site, and give admins richer in-row moderation controls.

## 1. Author recognition on threads

**`src/lib/marketplace.functions.ts` — `listCategoryThreads`**
- Extend the profile select to include `avatar_url`, `telegram_username`, `trades_completed`, `rating_sum`, `rating_count`.
- Extend `CategoryThread` type with `avatar_url`, `telegram_username`, `trades_completed`, `rating_avg`.

**`src/components/CategoryFeed.tsx` — `Row`**
- Render an `<Avatar>` (shadcn) with initials fallback in the Author cell.
- Show display name, premium/trusted icons, and a small "★ rating · N trades" sub-line.
- Wrap the author cell in a link to `/u/{user_id}` (new public profile route, see §3).

## 2. Live data across the website

**`CategoryFeed`** — already invalidates on `listings` changes. Add:
- A `postgres_changes` subscription on `profiles` (filtered to UPDATE) so badge/avatar changes propagate.
- Lower `refetchInterval` to `15_000` and `refetchOnWindowFocus: true` as a safety net.

**`src/routes/order-book.tsx`** — find the main listings list and wire the same realtime + query invalidation pattern (single channel per page, unsubscribed on unmount) so all order-book views update without reload.

**`src/components/TopAuthors.tsx`** — add a realtime subscription on `listings` and `profiles` to refresh the leaderboard live.

**`src/routes/admin.tsx` — `ThreadsPanel`** — add a `listings` realtime subscription that calls `refetch()` so admins always see the current state.

## 3. Public author profile (recognition target)

New route `src/routes/u.$userId.tsx` (public, SSR):
- Server fn `getPublicProfile({ userId })` returning `display_name`, `avatar_url`, `is_premium`, `is_trusted`, `trades_completed`, `rating_avg`, `joined_at`, plus their active threads via the existing listings query.
- Page shows avatar, name, badges, stats, and their threads list reusing `CategoryFeed`-style rows.
- Used as the link target from every thread author cell, the admin threads panel, and `TopAuthors`.

## 4. Admin controls (extend, don't replace)

**`src/lib/marketplace.functions.ts`** — add two server fns (admin/moderator gated, same role check pattern already used):
- `adminPinThread({ id, pinned })` — toggles a new `is_pinned` boolean on `listings`.
- `adminBanThreadAuthor({ id, reason })` — looks up `user_id` from the listing and calls existing `ban_user` RPC; also flips all that user's listings to `inactive`.

**Migration** (new file under `supabase/migrations/`):
- `ALTER TABLE public.listings ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;`
- Index `CREATE INDEX listings_pinned_active_idx ON public.listings (is_pinned DESC, created_at DESC) WHERE status = 'active';`
- No new tables → no GRANT block needed.

**`ThreadsPanel` in `src/routes/admin.tsx`** — add to each row:
- Author cell (avatar + display_name) with a link to `/u/{user_id}` — requires `adminListThreads` to also return author profile fields (extend the select + return shape).
- "Pin / Unpin" button calling `adminPinThread`.
- "Ban author" button (confirm dialog) calling `adminBanThreadAuthor`.
- Search box filtering by thread name or author display name (client-side, on the already-loaded list).

**`CategoryFeed` sort** — pinned threads first, then existing tier/recency order.

## 5. Out of scope
- No changes to shoutbox, trades, escrow, or wallet flows.
- No new tables; only one nullable-safe column added to `listings`.
- No changes to RLS policies (listings already readable; admin fns are SECURITY DEFINER via service role and gated by role check).

## Verification
- Build passes; `tsgo` clean.
- Open `/order-book` in two browser tabs, post a listing in one → row appears in the other within seconds with avatar + badges.
- Admin → Threads: pin a row, confirm it sticks to top of `CategoryFeed` on the home/order-book view.
- Click an author name anywhere → lands on `/u/{userId}` with their threads.