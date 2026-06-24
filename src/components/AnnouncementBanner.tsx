import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveAnnouncements } from "@/lib/announcements.functions";
import { Megaphone, X } from "lucide-react";

export function AnnouncementBanner() {
  const fetchAnn = useServerFn(listActiveAnnouncements);
  const { data } = useQuery({
    queryKey: ["active-announcements"],
    queryFn: () => fetchAnn(),
    staleTime: 60_000,
  });
  const items = (data?.announcements ?? []) as Array<{ id: string; title: string; body: string; link: string | null; published_at: string }>;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("edk_dismissed_announcements") || "[]";
      setDismissed(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);
  const visible = items.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;
  const a = visible[0];
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/5 to-background px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary">
          <Megaphone className="h-3.5 w-3.5 animate-pulse" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{a.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>
          {a.link && (
            <a href={a.link} className="mt-1 inline-block text-xs text-primary underline" target="_blank" rel="noreferrer">
              Learn more →
            </a>
          )}
        </div>
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            const next = new Set(dismissed); next.add(a.id);
            setDismissed(next);
            try { localStorage.setItem("edk_dismissed_announcements", JSON.stringify([...next])); } catch { /* ignore */ }
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
