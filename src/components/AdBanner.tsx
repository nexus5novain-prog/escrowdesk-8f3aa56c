import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listAdsForPlacement, trackAdEvent, type AdPlacement } from "@/lib/ads.functions";
import { fetchLinkPreview } from "@/lib/link-preview.functions";
import { supabase } from "@/integrations/supabase/client";
import { X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

type Ad = {
  id: string;
  title: string;
  media_type: "image" | "video" | "html" | "link";
  media_url: string | null;
  html_content: string | null;
  link_url: string | null;
  cta_label: string | null;
  placements: string[];
  priority: number;
  size_preset?: string | null;
  width?: number | null;
  height?: number | null;
};

interface Props {
  placement: AdPlacement;
  className?: string;
  dismissable?: boolean;
  rotateMs?: number;
  variant?: "banner" | "card" | "sidebar";
}

type MediaState = "idle" | "loading" | "loaded" | "error";

const ASPECT: Record<NonNullable<Props["variant"]>, string> = {
  banner: "aspect-[6/1]",
  card: "aspect-[16/9]",
  sidebar: "aspect-[4/5]",
};

export function AdBanner({ placement, className = "", dismissable = false, rotateMs = 12000, variant = "banner" }: Props) {
  const fn = useServerFn(listAdsForPlacement);
  const trackFn = useServerFn(trackAdEvent);
  const instanceId = useId();
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mediaState, setMediaState] = useState<MediaState>("idle");
  const trackedRef = useRef<Set<string>>(new Set());
  const errorTrackedRef = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoPlayingRef = useRef(false);

  const { data, refetch } = useQuery({
    queryKey: ["ads", placement],
    queryFn: () => fn({ data: { placement } }),
    staleTime: 5 * 60_000,
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  });

  // Debounced realtime refresh so a burst of admin edits doesn't thrash every
  // ad slot on the page.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`ads-${placement}-${instanceId.replace(/[^a-zA-Z0-9]/g, "")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ad_banners" }, () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => { refetch(); }, 1000);
      })
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [placement, refetch, instanceId]);

  const ads = useMemo<Ad[]>(() => (data?.ads ?? []) as Ad[], [data]);
  const ad = ads.length > 0 ? ads[idx % ads.length] : null;

  // Open-Graph preview for link-only ads
  const previewFn = useServerFn(fetchLinkPreview);
  const { data: linkPreview } = useQuery({
    queryKey: ["link-preview", ad?.id, ad?.link_url],
    queryFn: () => previewFn({ data: { url: ad!.link_url! } }),
    enabled: !!ad && ad.media_type === "link" && !!ad.link_url,
    staleTime: 6 * 3600_000,
  });

  // Reset media state whenever the active ad changes; preload the next ad's
  // image so the rotation crossfade swaps to something ready.
  useEffect(() => {
    if (!ad) return;
    setMediaState(ad.media_type === "image" || ad.media_type === "video" ? "loading" : "loaded");
    if (ads.length > 1) {
      const next = ads[(idx + 1) % ads.length];
      if (next?.media_type === "image" && next.media_url) {
        const img = new Image();
        img.src = next.media_url;
      }
    }
  }, [ad, ads, idx]);

  // 6s media timeout → fall back to CTA card if the asset is still loading.
  useEffect(() => {
    if (mediaState !== "loading") return;
    const t = setTimeout(() => {
      setMediaState((s) => (s === "loading" ? "error" : s));
      if (ad && !errorTrackedRef.current.has(ad.id)) {
        errorTrackedRef.current.add(ad.id);
        trackFn({ data: { ad_id: ad.id, kind: "error", placement } }).catch(() => {});
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [mediaState, ad, placement, trackFn]);

  // Rotation: hold while a video is playing, pause while off-screen.
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => {
      if (videoPlayingRef.current) return;
      setIdx((i) => (i + 1) % ads.length);
    }, rotateMs);
    return () => clearInterval(t);
  }, [ads.length, rotateMs]);

  // Impression tracking — fire once the slot is on-screen and rendered.
  useEffect(() => {
    if (!ad || !rootRef.current) return;
    if (mediaState === "loading") return;
    const target = rootRef.current;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !trackedRef.current.has(ad.id)) {
          trackedRef.current.add(ad.id);
          trackFn({ data: { ad_id: ad.id, kind: "impression", placement } }).catch(() => {});
        }
      }
    }, { threshold: 0.4 });
    obs.observe(target);
    return () => obs.disconnect();
  }, [ad, mediaState, placement, trackFn]);

  if (dismissed || !ad) return null;

  const sizeBase =
    variant === "sidebar" ? "rounded-lg" :
    variant === "card" ? "rounded-lg" : "rounded-md";

  const trackClick = () => {
    trackFn({ data: { ad_id: ad.id, kind: "click", placement } }).catch(() => {});
  };

  const handleMediaError = () => {
    setMediaState("error");
    if (!errorTrackedRef.current.has(ad.id)) {
      errorTrackedRef.current.add(ad.id);
      trackFn({ data: { ad_id: ad.id, kind: "error", placement } }).catch(() => {});
    }
  };

  // CTA fallback card — for link-only ads, broken media, and during long media
  // loads. Enriched with Open-Graph preview (image + description) when available.
  const ctaLabel = ad.cta_label?.trim() || (ad.link_url ? "Visit" : "Learn more");
  const previewImage = ad.media_type === "link" ? linkPreview?.image_url : null;
  const previewDesc = ad.media_type === "link" ? linkPreview?.description : null;
  const previewSite = ad.media_type === "link" ? linkPreview?.site_name : null;
  const fallbackCard = (
    <div className={`flex h-full w-full items-stretch gap-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ${variant === "sidebar" ? "flex-col" : ""}`}>
      {previewImage && (
        <div className={`relative shrink-0 overflow-hidden bg-secondary/40 ${variant === "sidebar" ? "h-32 w-full" : "h-full w-24 sm:w-32"}`}>
          <img src={previewImage} alt="" loading="lazy" decoding="async"
            className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Sponsored{previewSite ? ` · ${previewSite}` : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground sm:text-base">{ad.title}</p>
          {previewDesc && variant !== "banner" && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{previewDesc}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {ctaLabel} <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );

  // For HTML ads, refuse to wrap in an outer <a> when the sanitized payload
  // already contains an anchor — nested anchors break click tracking.
  const sanitizedHtml = ad.media_type === "html" && ad.html_content
    ? DOMPurify.sanitize(ad.html_content, {
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onmouseenter", "onmouseleave", "onkeydown", "onkeyup", "onsubmit", "onchange", "onblur", "onabort", "ondblclick"],
      })
    : "";
  const htmlContainsAnchor = sanitizedHtml.includes("<a ") || sanitizedHtml.includes("<a>");

  // Decide which body to render. media → if available + loaded/loading; otherwise
  // fall back to CTA card so the link is always visible.
  const showMedia =
    (ad.media_type === "image" && ad.media_url && mediaState !== "error") ||
    (ad.media_type === "video" && ad.media_url && mediaState !== "error") ||
    (ad.media_type === "html" && !!sanitizedHtml);

  const sizeStyle: React.CSSProperties =
    ad.width && ad.height ? { aspectRatio: `${ad.width} / ${ad.height}`, maxWidth: `${ad.width}px`, marginInline: "auto" } : {};

  const body = (
    <div
      ref={rootRef}
      style={sizeStyle}
      className={`group relative isolate w-full overflow-hidden border border-border/60 bg-secondary/20 transition-opacity duration-300 ${sizeBase}`}
    >
      {/* Reserve aspect so the slot doesn't collapse during load */}
      {!showMedia || ad.media_type === "link" ? (
        <div className={ad.media_type === "link" || (ad.width && ad.height) ? "h-full w-full" : ASPECT[variant]}>{fallbackCard}</div>
      ) : null}

      {ad.media_type === "image" && ad.media_url && mediaState !== "error" && (
        <img
          key={ad.id}
          src={ad.media_url}
          alt={ad.title}
          loading={variant === "banner" || variant === "sidebar" ? "eager" : "lazy"}
          decoding="async"
          className={`block w-full object-cover transition-opacity duration-300 ${mediaState === "loaded" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setMediaState("loaded")}
          onError={handleMediaError}
        />
      )}
      {ad.media_type === "video" && ad.media_url && mediaState !== "error" && (
        <video
          key={ad.id}
          src={ad.media_url}
          className={`block w-full transition-opacity duration-300 ${mediaState === "loaded" ? "opacity-100" : "opacity-0"}`}
          autoPlay muted loop playsInline preload="metadata"
          onLoadedData={() => setMediaState("loaded")}
          onPlay={() => { videoPlayingRef.current = true; }}
          onPause={() => { videoPlayingRef.current = false; }}
          onEnded={() => { videoPlayingRef.current = false; }}
          onError={handleMediaError}
        />
      )}
      {ad.media_type === "html" && sanitizedHtml && (
        <div className="ad-html prose-sm max-w-none p-3 text-sm [&_a]:text-primary [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      )}

      {/* Loading shimmer for media types that are still resolving */}
      {(ad.media_type === "image" || ad.media_type === "video") && mediaState === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-secondary/40 via-secondary/10 to-secondary/40" />
      )}

      {/* "Ad · title" overlay for non-card variants when real media is showing */}
      {variant !== "card" && showMedia && ad.media_type !== "link" && ad.media_type !== "html" && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground backdrop-blur">
          Ad · {ad.title}
        </div>
      )}

      {dismissable && (
        <Button
          size="icon" variant="ghost"
          aria-label="Dismiss"
          className="absolute right-1 top-1 z-10 h-6 w-6 bg-background/60 hover:bg-background"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  const wrapperCls = `block ${className}`;

  // HTML ads with inner anchors render as a plain block + a separate overlay
  // CTA button so we still capture clicks without invalid nested <a>s.
  if (ad.media_type === "html" && htmlContainsAnchor) {
    return (
      <div className={`${wrapperCls} relative`}>
        {body}
        {ad.link_url && (
          <a
            href={ad.link_url} target="_blank" rel="noreferrer sponsored"
            onClick={trackClick}
            className="pointer-events-auto absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-background/80 px-2.5 py-1 text-xs font-medium text-primary backdrop-blur hover:bg-primary/10"
          >
            {ctaLabel} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  if (ad.link_url) {
    return (
      <a href={ad.link_url} target="_blank" rel="noreferrer sponsored" className={wrapperCls} onClick={trackClick}>
        {body}
      </a>
    );
  }
  return <div className={wrapperCls}>{body}</div>;
}
