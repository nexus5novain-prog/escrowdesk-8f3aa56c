import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UrlSchema = z.object({ url: z.string().url().max(2000) });

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
const VID_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

function absolutize(base: string, candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try { return new URL(candidate, base).toString(); } catch { return null; }
}

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UrlSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: cached } = await supabaseAdmin
      .from("link_previews").select("*").eq("url", data.url).gte("fetched_at", dayAgo).maybeSingle();
    if (cached) return cached;

    const hostname = (() => { try { return new URL(data.url).hostname; } catch { return null; } })();

    // Fast path: URL itself points directly at a media asset. HEAD first to
    // confirm content-type without pulling the whole asset.
    const urlLooksImage = IMG_EXT.test(data.url);
    const urlLooksVideo = VID_EXT.test(data.url);
    if (urlLooksImage || urlLooksVideo) {
      try {
        const head = await fetch(data.url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
        const ct = head.headers.get("content-type") ?? "";
        if (ct.startsWith("image/") || (!ct && urlLooksImage)) {
          const row = { url: data.url, title: null, description: null, image_url: data.url, video_url: null, media_kind: "image" as const, site_name: hostname, fetched_at: new Date().toISOString() };
          await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
          return row;
        }
        if (ct.startsWith("video/") || (!ct && urlLooksVideo)) {
          const row = { url: data.url, title: null, description: null, image_url: null, video_url: data.url, media_kind: "video" as const, site_name: hostname, fetched_at: new Date().toISOString() };
          await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
          return row;
        }
      } catch { /* fall through to HTML scrape */ }
    }

    try {
      const res = await fetch(data.url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 EscrowDeskBot/1.0", Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(6000),
      });
      const ct = res.headers.get("content-type") ?? "";

      // Direct asset served without a recognizable extension (e.g. CDN paths)
      if (ct.startsWith("image/")) {
        const row = { url: data.url, title: null, description: null, image_url: data.url, video_url: null, media_kind: "image" as const, site_name: hostname, fetched_at: new Date().toISOString() };
        await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
        return row;
      }
      if (ct.startsWith("video/")) {
        const row = { url: data.url, title: null, description: null, image_url: null, video_url: data.url, media_kind: "video" as const, site_name: hostname, fetched_at: new Date().toISOString() };
        await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
        return row;
      }

      const html = (await res.text()).slice(0, 200_000);
      const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
      const meta = (name: string) =>
        pick(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
        pick(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"));

      const title = meta("og:title") ?? pick(/<title>([^<]+)<\/title>/i);
      const description = meta("og:description") ?? meta("description");
      const image_url = absolutize(data.url, meta("og:image") ?? meta("twitter:image"));
      const site_name = meta("og:site_name") ?? hostname;

      // Detect an embeddable video on the page: og:video, og:video:url,
      // twitter:player:stream, or a <video src="..."> / <source src="..."> tag.
      let video_url: string | null =
        meta("og:video:secure_url") ??
        meta("og:video:url") ??
        meta("og:video") ??
        meta("twitter:player:stream") ??
        null;
      if (!video_url) {
        const videoTag = pick(/<video[^>]+src=["']([^"']+)["']/i);
        const sourceTag = pick(/<source[^>]+src=["']([^"']+\.(?:mp4|webm|ogg|m4v|mov))[^"']*["']/i);
        video_url = videoTag ?? sourceTag ?? null;
      }
      video_url = absolutize(data.url, video_url);
      // Only keep when it looks like an actual playable file, not an embed page
      if (video_url && !VID_EXT.test(video_url) && !/\.m3u8(\?|#|$)/i.test(video_url)) {
        video_url = null;
      }

      const media_kind: "image" | "video" | "none" =
        video_url ? "video" : image_url ? "image" : "none";

      const row = {
        url: data.url,
        title: title?.slice(0, 200) ?? null,
        description: description?.slice(0, 400) ?? null,
        image_url: image_url ?? null,
        video_url,
        media_kind,
        site_name: site_name ?? null,
        fetched_at: new Date().toISOString(),
      };
      await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
      return row;
    } catch (e) {
      console.warn("[link-preview] fetch failed", e);
      return { url: data.url, title: null, description: null, image_url: null, video_url: null, media_kind: "none" as const, site_name: hostname, fetched_at: new Date().toISOString() };
    }
  });
