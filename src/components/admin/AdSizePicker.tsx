import { AD_SIZE_PRESETS, getPreset, type AdSizePreset } from "@/lib/ad-sizes";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  presetKey: string | null;
  width: number | null;
  height: number | null;
  onChange: (v: { size_preset: string; width: number | null; height: number | null }) => void;
}

const MAX_PREVIEW = 120;

export function AdSizePicker({ presetKey, width, height, onChange }: Props) {
  const groups = Array.from(new Set(AD_SIZE_PRESETS.map((p) => p.category)));
  const selected = getPreset(presetKey);

  const pick = (p: AdSizePreset) =>
    onChange({ size_preset: p.key, width: p.width, height: p.height });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">Banner size</Label>
        {(width && height) ? (
          <span className="font-mono text-[11px] text-muted-foreground">{width} × {height}px</span>
        ) : null}
      </div>

      <div className="space-y-4 rounded-lg border border-border/60 bg-secondary/20 p-3">
        {groups.map((cat) => (
          <div key={cat}>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{cat}</p>
            <div className="flex flex-wrap gap-3">
              {AD_SIZE_PRESETS.filter((p) => p.category === cat).map((p) => {
                const isSelected = selected?.key === p.key;
                const scale = Math.min(MAX_PREVIEW / p.width, 60 / p.height, 0.4);
                const dispW = Math.max(28, Math.round(p.width * scale));
                const dispH = Math.max(8, Math.round(p.height * scale));
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pick(p)}
                    className={`flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all hover-scale ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                        : "border-border/60 bg-background hover:border-primary/40"
                    }`}
                    title={`${p.label} · ${p.width}×${p.height}`}
                  >
                    <div className="grid place-items-center" style={{ width: MAX_PREVIEW, height: 64 }}>
                      <div
                        className={`rounded-sm border ${isSelected ? "border-primary bg-primary/30" : "border-muted-foreground/60 bg-muted-foreground/10"}`}
                        style={{ width: dispW, height: dispH }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold leading-tight">{p.label}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{p.width}×{p.height}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-end gap-3 border-t border-border/40 pt-3">
          <div className="flex-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Custom width</Label>
            <Input
              type="number" min={50} max={2000}
              value={width ?? ""}
              onChange={(e) => onChange({ size_preset: "custom", width: Number(e.target.value) || null, height })}
            />
          </div>
          <span className="pb-2 text-muted-foreground">×</span>
          <div className="flex-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Custom height</Label>
            <Input
              type="number" min={20} max={2000}
              value={height ?? ""}
              onChange={(e) => onChange({ size_preset: "custom", width, height: Number(e.target.value) || null })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
