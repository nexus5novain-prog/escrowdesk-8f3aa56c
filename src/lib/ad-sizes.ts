// Shared IAB-style ad size presets. Width/height in CSS pixels.
export type AdSizePreset = {
  key: string;
  label: string;
  width: number;
  height: number;
  category: "Banner" | "Rectangle" | "Skyscraper" | "Mobile" | "Large" | "Square" | "Custom";
};

export const AD_SIZE_PRESETS: AdSizePreset[] = [
  { key: "leaderboard_728x90",      label: "Leaderboard",       width: 728, height: 90,  category: "Banner" },
  { key: "billboard_970x250",       label: "Billboard",         width: 970, height: 250, category: "Banner" },
  { key: "super_banner_970x90",     label: "Super Banner",      width: 970, height: 90,  category: "Banner" },
  { key: "banner_468x60",           label: "Banner",            width: 468, height: 60,  category: "Banner" },
  { key: "medium_rectangle_300x250",label: "Medium Rectangle",  width: 300, height: 250, category: "Rectangle" },
  { key: "large_rectangle_336x280", label: "Large Rectangle",   width: 336, height: 280, category: "Rectangle" },
  { key: "small_rectangle_180x150", label: "Small Rectangle",   width: 180, height: 150, category: "Rectangle" },
  { key: "square_250x250",          label: "Square",            width: 250, height: 250, category: "Square" },
  { key: "small_square_200x200",    label: "Small Square",      width: 200, height: 200, category: "Square" },
  { key: "wide_skyscraper_160x600", label: "Wide Skyscraper",   width: 160, height: 600, category: "Skyscraper" },
  { key: "skyscraper_120x600",      label: "Skyscraper",        width: 120, height: 600, category: "Skyscraper" },
  { key: "half_page_300x600",       label: "Half Page",         width: 300, height: 600, category: "Large" },
  { key: "portrait_300x1050",       label: "Portrait",          width: 300, height: 1050,category: "Large" },
  { key: "mobile_banner_320x50",    label: "Mobile Banner",     width: 320, height: 50,  category: "Mobile" },
  { key: "large_mobile_320x100",    label: "Large Mobile Banner", width: 320, height: 100, category: "Mobile" },
  { key: "mobile_rectangle_300x100",label: "Mobile Rectangle",  width: 300, height: 100, category: "Mobile" },
];

export function getPreset(key: string | null | undefined): AdSizePreset | null {
  if (!key) return null;
  return AD_SIZE_PRESETS.find((p) => p.key === key) ?? null;
}
