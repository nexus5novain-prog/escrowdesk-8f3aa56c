import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UrlSchema = z.object({ url: z.string().url().max(2000) });

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UrlSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: cached } = await supabaseAdmin
      .from("link_previews").select("*").eq("url", data.url).gte("fetched_at", dayAgo).maybeSingle();
    if (cached) return cached;

    try {
      const res = await fetch(data.url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 EscrowDeskBot/1.0", Accept: "text/html" },
        signal: AbortSignal.timeout(6000),
      });
      const html = (await res.text()).slice(0, 200_000);
      const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
      const meta = (name: string) =>
        pick(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
        pick(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"));
      const title = meta("og:title") ?? pick(/<title>([^<]+)<\/title>/i);
      const description = meta("og:description") ?? meta("description");
      const image_url = meta("og:image") ?? meta("twitter:image");
      const site_name = meta("og:site_name") ?? new URL(data.url).hostname;

      const row = {
        url: data.url,
        title: title?.slice(0, 200) ?? null,
        description: description?.slice(0, 400) ?? null,
        image_url: image_url ?? null,
        site_name: site_name ?? null,
        fetched_at: new Date().toISOString(),
      };
      await supabaseAdmin.from("link_previews").upsert(row as never, { onConflict: "url" });
      return row;
    } catch (e) {
      console.warn("[link-preview] fetch failed", e);
      return { url: data.url, title: null, description: null, image_url: null, site_name: new URL(data.url).hostname, fetched_at: new Date().toISOString() };
    }
  });
