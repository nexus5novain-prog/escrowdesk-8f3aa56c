// AdSlot — sized wrapper around AdBanner that reserves an exact width × height
// box (from a preset or explicit dimensions). Prevents layout shift on load
// and renders the ad scaled into the slot without distortion.
import { AdBanner } from "./AdBanner";
import { getPreset } from "@/lib/ad-sizes";
import type { AdPlacement } from "@/lib/ads.functions";
import { cn } from "@/lib/utils";

interface Props {
  placement: AdPlacement;
  size?: string;        // preset key
  width?: number;
  height?: number;
  mobileSize?: string;  // preset key fallback on small screens
  className?: string;
  dismissable?: boolean;
}

export function AdSlot({
  placement, size, width, height, mobileSize, className, dismissable,
}: Props) {
  const preset = getPreset(size);
  const w = width ?? preset?.width;
  const h = height ?? preset?.height;
  const mPreset = getPreset(mobileSize);

  // Reserve aspect via inline max-width / aspect-ratio so the slot doesn't
  // collapse before the ad payload resolves, on every viewport.
  const desktopStyle: React.CSSProperties = w && h ? {
    maxWidth: `${w}px`,
    aspectRatio: `${w} / ${h}`,
    width: "100%",
  } : {};
  const mobileStyle: React.CSSProperties = mPreset ? {
    maxWidth: `${mPreset.width}px`,
    aspectRatio: `${mPreset.width} / ${mPreset.height}`,
    width: "100%",
  } : desktopStyle;

  // Pick the right shape variant based on the aspect we have.
  const aspect = w && h ? w / h : 6;
  const variant: "banner" | "card" | "sidebar" =
    aspect >= 3 ? "banner" : aspect <= 0.6 ? "sidebar" : "card";

  return (
    <div className={cn("mx-auto flex w-full justify-center", className)}>
      {mPreset ? (
        <>
          <div className="hidden sm:block" style={desktopStyle}>
            <AdBanner placement={placement} variant={variant} dismissable={dismissable} className="h-full w-full [&>div]:h-full" />
          </div>
          <div className="block sm:hidden" style={mobileStyle}>
            <AdBanner placement={placement} variant={variant} dismissable={dismissable} className="h-full w-full [&>div]:h-full" />
          </div>
        </>
      ) : (
        <div style={desktopStyle} className="w-full">
          <AdBanner placement={placement} variant={variant} dismissable={dismissable} className="h-full w-full [&>div]:h-full" />
        </div>
      )}
    </div>
  );
}
