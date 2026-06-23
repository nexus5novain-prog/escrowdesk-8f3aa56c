// Curated credit-card mockup backgrounds.
// Pick one with cardStyle(id, idx?) — deterministic per listing id.

export type CardStyle = {
  /** Tailwind classes for the card background. */
  bg: string;
  /** Decorative overlay (subtle pattern) injected absolutely. */
  pattern: string;
  /** Foreground/text class for legibility. */
  fg: string;
  /** Accent ring/border. */
  accent: string;
  /** Short label for sellers / admin. */
  label: string;
};

export const CARD_STYLES: CardStyle[] = [
  {
    label: "Midnight",
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900",
    pattern: "bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_55%)]",
    fg: "text-white",
    accent: "ring-indigo-500/40",
  },
  {
    label: "Crimson",
    bg: "bg-gradient-to-br from-rose-600 via-red-700 to-rose-900",
    pattern: "bg-[radial-gradient(circle_at_bottom_left,rgba(251,113,133,0.45),transparent_60%)]",
    fg: "text-white",
    accent: "ring-rose-400/40",
  },
  {
    label: "Aurora",
    bg: "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700",
    pattern: "bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.5),transparent_60%)]",
    fg: "text-white",
    accent: "ring-emerald-300/50",
  },
  {
    label: "Sunset",
    bg: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-600",
    pattern: "bg-[radial-gradient(circle_at_top_right,rgba(253,224,71,0.45),transparent_55%)]",
    fg: "text-white",
    accent: "ring-amber-300/50",
  },
  {
    label: "Royal",
    bg: "bg-gradient-to-br from-violet-700 via-fuchsia-700 to-purple-900",
    pattern: "bg-[radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.45),transparent_60%)]",
    fg: "text-white",
    accent: "ring-fuchsia-400/40",
  },
  {
    label: "Ocean",
    bg: "bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800",
    pattern: "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.45),transparent_60%)]",
    fg: "text-white",
    accent: "ring-sky-400/40",
  },
  {
    label: "Carbon",
    bg: "bg-gradient-to-br from-neutral-900 via-zinc-900 to-black",
    pattern: "bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_50%)]",
    fg: "text-white",
    accent: "ring-yellow-400/40",
  },
  {
    label: "Mint",
    bg: "bg-gradient-to-br from-lime-400 via-emerald-500 to-teal-600",
    pattern: "bg-[radial-gradient(circle_at_bottom_left,rgba(190,242,100,0.5),transparent_55%)]",
    fg: "text-emerald-950",
    accent: "ring-lime-300/60",
  },
];

/** Pick a deterministic style for an id (UUID/string) when DB style is missing. */
export function pickCardStyle(id: string | number | null | undefined): CardStyle {
  if (id == null) return CARD_STYLES[0];
  if (typeof id === "number") return CARD_STYLES[id % CARD_STYLES.length];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_STYLES[h % CARD_STYLES.length];
}

/** Resolve by stored index when present, else hash id. */
export function styleFor(id: string, idx?: number | null): CardStyle {
  if (idx != null && idx >= 0) return CARD_STYLES[idx % CARD_STYLES.length];
  return pickCardStyle(id);
}
