// Centralized list of the marketplace categories.
// Stored as plain text in marketplace_products.category for forward-compat.

export type MarketplaceCategory = "BIN/CC" | "ENROLL" | "SCANNER" | "COMBO" | "OTHERS";

export const MARKETPLACE_CATEGORIES: {
  value: MarketplaceCategory;
  label: string;
  blurb: string;
  hue: string; // for placeholder gradient
}[] = [
  { value: "BIN/CC",  label: "BINs / CCs",    blurb: "Verified BIN & credit card listings",  hue: "from-rose-500/30 to-fuchsia-500/20" },
  { value: "ENROLL",  label: "Enroll Store",  blurb: "Enrollment kits & guides",             hue: "from-amber-500/30 to-orange-500/20" },
  { value: "SCANNER", label: "Scanner Store", blurb: "Scanners & related tooling",           hue: "from-emerald-500/30 to-teal-500/20" },
  { value: "COMBO",   label: "Combo Store",   blurb: "Multi-item bundles & combo packs",     hue: "from-sky-500/30 to-indigo-500/20" },
  { value: "OTHERS",  label: "Others",        blurb: "Everything that doesn't fit elsewhere", hue: "from-slate-500/30 to-zinc-500/20" },
];

export const MARKETPLACE_CATEGORY_VALUES: MarketplaceCategory[] =
  MARKETPLACE_CATEGORIES.map((c) => c.value);

export const isMarketplaceCategory = (s: string): s is MarketplaceCategory =>
  MARKETPLACE_CATEGORY_VALUES.includes(s as MarketplaceCategory);

export const categoryHue = (c: string) =>
  MARKETPLACE_CATEGORIES.find((x) => x.value === c)?.hue ?? "from-primary/20 to-primary/10";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "name", label: "Name (A–Z)" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
