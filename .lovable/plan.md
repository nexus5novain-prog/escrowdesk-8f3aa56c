# Reliable ad rendering across every page

## Goal

An ad that an admin creates must always be visible on the pages where its placement appears — whether the asset is an image, a video, an HTML embed, or just a click-through link — and it must keep displaying without losing the slot while the page refetches, rotates, or while a media URL is slow to load.

## What's wrong today

1. **Link-only ads render as an empty box.** `AdBanner` only outputs a body when `media_url` or `html_content` exists. A banner whose only payload is `link_url` shows nothing.
2. **No media error fallback.** A broken image URL, a blocked CORS host, or a failing video produces a broken icon, a 0 px tall element, or a blank black box. The click-through link goes with it.
3. **Ad flickers on every refetch.** The query lacks `placeholderData: keepPreviousData`, so the 120 s background refetch and every realtime `ad_banners` event briefly unmount the current ad.
4. **Rotation tears down mid-play videos** every 12 s with no transition, causing a visible flash and lost playback.
5. **Nested anchors in HTML ads.** If an HTML ad already contains an `<a>`, wrapping the body in another `<a href={link_url}>` produces invalid markup; browsers split it and click tracking stops working.
6. **No admin-side reality check.** The admin form has an image preview only; you can't see what the banner will actually look like in a `banner` / `card` / `sidebar` slot before it ships.

## What to build

### 1. `AdBanner` — always render something

- Track per-asset state: `idle | loading | loaded | error`. Use `onLoad`/`onError` on `<img>`, `loadeddata`/`error` on `<video>`.
- If `media_type` is image or video and the asset errors **or** stays in `loading` after a 6 s timeout, swap to the **CTA fallback card**: title + short description + a "Visit" arrow, styled per `variant`. This keeps the slot occupied and the link clickable.
- If the ad has neither media nor html (link-only), render the CTA fallback card as the primary body — never an empty div.
- Images: add `loading="eager"` for `sidebar`/`banner` variants and `decoding="async"`, and a fixed aspect ratio per variant so the slot doesn't collapse before load.
- Videos: add `preload="metadata"`, `playsInline`, `muted`, `loop`, and a `poster` derived from `media_url` (or fall back to CTA card on error).
- Never wrap an HTML ad in an outer `<a>` if its sanitized content already contains an `<a>` — render the click target as an overlay button instead so tracking still fires.

### 2. No flicker on refetch or realtime updates

- Add `placeholderData: keepPreviousData` and lift `staleTime` to 5 min on the `listAdsForPlacement` query.
- When the realtime channel fires, invalidate but keep showing the current ad until the next payload resolves.
- Debounce realtime invalidations to 1 s so a burst of admin edits doesn't thrash every slot on the page.

### 3. Smooth rotation

- Only advance the rotation index when the **next** ad's media has preloaded (preload it in a hidden `<img>`/`<link rel="preload">` ahead of the swap).
- Pause rotation while a video ad is actively playing; resume on `ended`.
- Crossfade between ads with a 250 ms opacity transition so the swap is never a blink.
- Pause rotation when the slot is off-screen (reuse the existing `IntersectionObserver`).

### 4. Real "Link / CTA" media type

- Add `"link"` to `AdMediaType`, the Zod enum, and the admin form's media-type select.
- Admin form fields when `media_type === "link"`: required `link_url`, optional `cta_label` (default "Learn more"), optional short `description` (already covered by `title`).
- Server validation: for `"link"`, require `link_url`; ignore `media_url`/`html_content`.
- `AdBanner` renders link-type ads with the CTA fallback card (same component used for media-failure fallback) so behavior is consistent.

### 5. Admin: live preview + health check

- In `AdsPanel`, render an inline `<AdBanner>` mock for the form's current values across all three variants (`banner`, `card`, `sidebar`) so the admin sees exactly what every page will show.
- In the "All banners" list, badge each ad with media health:
  - `OK` once an impression has been recorded in the last 24 h,
  - `Check URL` if the most recent client load reported an error (write the error to `ad_events` with `kind: "error"`),
  - `Pending` otherwise.
- This makes broken links obvious from `/admin` without opening every page.

### 6. Click + impression tracking stays correct

- Impression: fire once per ad per mount once it actually paints (current `IntersectionObserver` is fine, gate on `state === "loaded"` or fallback rendered).
- Click: fire from the wrapper button or anchor regardless of which body variant rendered (media, html, or CTA fallback).
- New `kind: "error"` event written client-side when media fails to load, used by the admin health badge.

## Technical notes

- Files touched:
  - `src/components/AdBanner.tsx` — state machine, fallback card, preload, crossfade, anchor-safety for HTML ads, `keepPreviousData`, error event tracking.
  - `src/lib/ads.functions.ts` — add `"link"` to `AdMediaType` + `PlacementSchema`-adjacent enum, add optional `cta_label` column handling, accept `kind: "error"` in `trackAdEvent`, add a `recentAdHealth` server fn for the admin badge.
  - `src/routes/admin.tsx` (`AdsPanel`) — add `"link"` media type, `cta_label` input, live `<AdBanner>` preview block, health badges in the banners list.
  - DB migration:
    - `ALTER TABLE public.ad_banners ADD COLUMN cta_label TEXT;`
    - Extend the `ad_events.kind` check constraint to allow `"error"` (or drop and recreate it).
    - Regenerate types after the migration runs.
- Behavior contract: `AdBanner` returns `null` only if the placement truly has zero active ads. As long as the placement has at least one active ad, the slot always renders **something** clickable.
- No change to placement ids, layout breakpoints, or the order-book "show sidebar only when an ad exists" logic — that conditional still works because we keep returning `null` when there are no ads at all.

## Out of scope

- No changes to other pages' layouts.
- No new placements.
- No analytics dashboard changes beyond surfacing the new `error` event in the health badge.
