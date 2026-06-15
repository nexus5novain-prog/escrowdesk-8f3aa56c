// Centralized list of the four marketplace categories.
// Stored as plain text in marketplace_products.category for forward-compat.

export type MarketplaceCategory = "BIN" | "Enroll" | "Scanner" | "Combo";

export const MARKETPLACE_CATEGORIES: {
  value: MarketplaceCategory;
  label: string;
  blurb: string;
  hue: string; // for placeholder gradient
}[] = [
  { value: "BIN",     label: "BIN Store",     blurb: "Search & buy verified BIN products",   hue: "from-rose-500/30 to-fuchsia-500/20" },
  { value: "Enroll",  label: "Enroll Store",  blurb: "Enrollment kits & guides",             hue: "from-amber-500/30 to-orange-500/20" },
  { value: "Scanner", label: "Scanner Store", blurb: "Scanners & related tooling",           hue: "from-emerald-500/30 to-teal-500/20" },
  { value: "Combo",   label: "Combo Store",   blurb: "Multi-item bundles & combo packs",     hue: "from-sky-500/30 to-indigo-500/20" },
];

export const isMarketplaceCategory = (s: string): s is MarketplaceCategory =>
  MARKETPLACE_CATEGORIES.some((c) => c.value === s);

export const categoryHue = (c: string) =>
  MARKETPLACE_CATEGORIES.find((x) => x.value === c)?.hue ?? "from-primary/20 to-primary/10";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "name", label: "Name (A–Z)" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
