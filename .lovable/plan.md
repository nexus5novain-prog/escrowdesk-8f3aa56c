# Phase 2 — Notifications, Live Wallet, Escrow Portfolio, Ads System

This is a large, multi-system request. I'll group it into 4 independent workstreams. Each is buildable on its own; please confirm the order or trim what you don't want before I start.

---

## 1. Real-time Notification System (in-app bell + Telegram)

**DB migration:**
- `notifications` — `user_id`, `kind` (enum: `escrow_invoice_created`, `escrow_payment_detected`, `escrow_settled`, `escrow_expired`, `trade_signed`, `trade_paid`, `trade_released`, `trade_cancelled`, `dispute_opened`, `dispute_resolved`, `arbitration_update`, `wallet_credit`, `wallet_debit`, `admin_warning`, `admin_ban`), `title`, `body`, `link` (e.g. `/trade/abc`), `payload jsonb`, `read_at`, `created_at`. RLS: user reads own. Realtime enabled.
- `notification_preferences` — `user_id`, `kind`, `in_app boolean default true`, `telegram boolean default true`. Composite PK.
- DB function `notify_user(_user, _kind, _title, _body, _link, _payload)` — inserts row + queues Telegram send if pref enabled and `telegram_user_id` set.

**Server:**
- `src/lib/notifications.functions.ts` — `listMine`, `markRead`, `markAllRead`, `getPrefs`, `updatePref({kind, in_app, telegram})`.
- Hook `notify_user` into BTCPay webhook (created/processing/settled/expired), `confirm_buyer_deposit`, `sign_terms`, `release_trade`, `cancel_trade`, `open_dispute`, `resolve_dispute`, `ban_user`, `warn_user`, escrow credit/debit.
- Telegram delivery via existing `tgSendMessage` with HTML deep link to `https://escrowdesk.lovable.app{link}`.

**UI:**
- `<NotificationBell />` in `SiteHeader` — badge with unread count, dropdown panel listing latest 20, click marks read + navigates. Realtime subscription on `notifications` filtered by `user_id`.
- `/settings` → new "Notifications" tab: grid of all kinds × (in-app | telegram) toggles + Telegram link status.

---

## 2. Wallet Page Redesign — Live BTC/LN Portfolio

**Server:** `src/lib/wallet-live.functions.ts`
- `getLivePortfolio()` — returns `{ onchain: { confirmed, unconfirmed }, lightning: { local_balance, remote_balance }, internal: { available, escrow }, btc_usd_rate }` by calling BTCPay `/api/v1/stores/{id}/payment-methods/onchain/BTC/wallet` and `/lightning/BTC/balance`, plus internal `wallets` row, plus CoinGecko price.

**UI:** new `src/components/wallet/PortfolioHero.tsx`
- Hero card: total USD value, animated count-up, 24h sparkline.
- Three balance tiles: On-chain BTC, Lightning, Internal escrow — each with live indicator dot, last-updated timestamp.
- React Query `refetchInterval: 15s` + realtime subscribe to `wallets` and `escrow_invoices` for instant updates on user-affecting changes.
- Replaces current `wallet.tsx` body, keeps transactions list below.

---

## 3. Escrow Portfolio Page — Animated Particle Background

New route `src/routes/escrow-portfolio.tsx` (or replace `escrow.$id` hero):
- Full-bleed canvas-based **moving particle background** (lightweight, ~60 particles, drift + connecting lines, BTC-orange tint, prefers-reduced-motion respected).
- Stat cards with **animated counters** (CountUp): total escrowed BTC, active invoices, settled this month, total volume.
- Live list of recent escrow invoices with status pulse animation.
- Sourced from `escrow_invoices`, `escrow_events`, `trades`.

---

## 4. Ads System Overhaul

**DB migration on `ad_banners`:**
- Add `size_preset text` (IAB names: `leaderboard_728x90`, `medium_rectangle_300x250`, `wide_skyscraper_160x600`, `mobile_banner_320x50`, `large_rectangle_336x280`, `half_page_300x600`, `billboard_970x250`, `square_250x250`, `responsive_fluid`).
- Add `width int`, `height int`.

**Admin (`src/routes/admin.tsx` Ads tab):**
- New "Size & Placement" section in ad editor: visual grid of size presets, each showing a scaled rectangle icon with WxH label. Selecting auto-fills width/height. Custom option allows manual entry.
- Preview pane renders the ad at chosen size before saving.

**Display (`src/components/AdBanner.tsx` + new `<AdSlot />`):**
- Reserve exact `width × height` via CSS `aspect-ratio` and min-height — **prevents layout shift** even before content loads.
- Loading: skeleton at exact size.
- Image: `<img>` with `loading="lazy"`, `decoding="async"`, fallback to placeholder if 404.
- Video: `<video autoplay muted loop playsinline>` with poster fallback.
- Link-only: rendered as card with og-fetched title/desc (server fn `fetchLinkPreview` with 24h cache table `link_previews`).
- Rotation: if multiple ads match a placement, rotate every 8s with fade.
- Add `<AdSlot placement="home_top" size="leaderboard_728x90" />` to: index, marketplace, order-book, wallet, trades, escrow, product pages (responsive: leaderboard → medium-rectangle on mobile).

---

## Scope check — confirm before I build

This is roughly 1 large migration + ~15 new/edited files per workstream. Options:
1. **Build all 4 in order (1 → 2 → 3 → 4)** — large change, single review.
2. **Just notifications + ads** (workstreams 1 & 4) — highest user-visible impact.
3. **Pick a different subset.**

Which do you want?
