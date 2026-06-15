import { categoryHue } from "@/lib/marketplace-categories";
import { ShoppingBag, CreditCard, ScanLine, Layers, Boxes } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BIN: CreditCard,
  Enroll: Layers,
  Scanner: ScanLine,
  Combo: Boxes,
};

export function CategoryPlaceholder({ category, name }: { category: string; name?: string }) {
  const hue = categoryHue(category);
  const cardLabel = name ?? category;
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-3xl bg-gradient-to-br ${hue} p-5 text-foreground`}> 
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.3), transparent 56%)" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(0,0,0,0.18),_transparent_35%)]" />
      {category === "BIN" ? (
        <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-lg shadow-black/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/80">
            <span>BIN Store</span>
            <span className="rounded-full bg-white/10 px-2 py-1">Verified</span>
          </div>
          <div className="space-y-3">
            <div className="text-xs text-white/70">Card number</div>
            <div className="text-xl font-semibold tracking-[0.28em]">123456 <span className="text-white/30">**** **** ****</span></div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/75">
              <span>CVV •••</span>
              <span>EXP 12/28</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/75">
            <span>{cardLabel}</span>
            <span>{category}</span>
          </div>
        </div>
      ) : category === "Enroll" ? (
        <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-black/10 p-5 text-white/90 shadow-lg shadow-black/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/70">
            <span>Enroll Kit</span>
            <span className="rounded-full bg-white/10 px-2 py-1">Starter</span>
          </div>
          <div className="space-y-3">
            <div className="text-lg font-semibold">Enrollment Package</div>
            <div className="text-sm text-white/70">Secure tips, templates & onboarding flow for new accounts.</div>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/70">
            <span>{cardLabel}</span>
            <span>Fast setup</span>
          </div>
        </div>
      ) : category === "Scanner" ? (
        <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-black/10 p-5 text-white/90 shadow-lg shadow-black/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/70">
            <span>Scanner</span>
            <span className="rounded-full bg-white/10 px-2 py-1">Secure</span>
          </div>
          <div className="space-y-3">
            <div className="text-lg font-semibold">Scanner Suite</div>
            <div className="text-sm text-white/70">Real-time checks, live validation, BIN lookup and risk insights.</div>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/70">
            <span>{cardLabel}</span>
            <span>Quick scan</span>
          </div>
        </div>
      ) : (
        <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-black/10 p-5 text-white/90 shadow-lg shadow-black/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/70">
            <span>Combo Pack</span>
            <span className="rounded-full bg-white/10 px-2 py-1">Bundle</span>
          </div>
          <div className="space-y-3">
            <div className="text-lg font-semibold">Combo Deal</div>
            <div className="text-sm text-white/70">Curated bundle with multiple gift-card styles and payout options.</div>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/70">
            <span>{cardLabel}</span>
            <span>Mixed items</span>
          </div>
        </div>
      )}
    </div>
  );
}
