import { styleFor } from "@/lib/card-styles";
import { Wifi } from "lucide-react";

interface Props {
  id: string;
  cardStyle?: number | null;
  brand?: string | null;       // VISA / Mastercard / Amex …
  bank?: string | null;
  holder?: string | null;
  cardNumber?: string | null;  // raw or BIN
  binNumber?: string | null;
  expire?: string | null;
  type?: string | null;        // credit / debit
  /** Compact mode for grid cards (smaller font). */
  compact?: boolean;
}

function maskNumber(num?: string | null, bin?: string | null) {
  const digits = (num ?? "").replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}  ${digits.slice(4, 6)}••  ••••  ••••`;
  }
  if (bin) return `${bin.padEnd(6, "•")}  ••••  ••••  ••••`;
  return "••••  ••••  ••••  ••••";
}

function brandMark(brand?: string | null) {
  const b = (brand ?? "").toLowerCase();
  if (b.includes("visa")) return <span className="font-serif italic text-2xl font-black tracking-tight">VISA</span>;
  if (b.includes("master")) return (
    <span className="flex items-center">
      <span className="h-5 w-5 rounded-full bg-red-500/90 -mr-2" />
      <span className="h-5 w-5 rounded-full bg-amber-400/90 mix-blend-screen" />
    </span>
  );
  if (b.includes("amex") || b.includes("express")) return <span className="font-bold tracking-widest text-[11px]">AMEX</span>;
  if (b.includes("discover")) return <span className="font-bold tracking-widest text-[11px]">DISCOVER</span>;
  return <span className="font-bold tracking-widest text-[11px] opacity-80">{brand?.toUpperCase() || "CARD"}</span>;
}

export function CreditCardArt({
  id, cardStyle, brand, bank, holder, cardNumber, binNumber, expire, type, compact = false,
}: Props) {
  const s = styleFor(id, cardStyle);
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-xl ${s.bg} ${s.fg} ring-1 ${s.accent} shadow-lg`}
      data-card-style={s.label}
    >
      {/* Decorative pattern */}
      <div className={`pointer-events-none absolute inset-0 ${s.pattern}`} />
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-black/10 blur-2xl" />

      {/* Top row: bank + contactless */}
      <div className={`relative flex items-start justify-between ${compact ? "p-3" : "p-4"}`}>
        <div className="min-w-0">
          <div className={`truncate font-semibold ${compact ? "text-[11px]" : "text-sm"} opacity-95`}>
            {bank || "Issuer Bank"}
          </div>
          {type && (
            <div className="mt-0.5 inline-block rounded-sm bg-white/15 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest">
              {type}
            </div>
          )}
        </div>
        <Wifi className={`opacity-90 ${compact ? "h-4 w-4" : "h-5 w-5"} -rotate-90`} />
      </div>

      {/* Chip */}
      <div className={`relative ${compact ? "px-3" : "px-4"}`}>
        <div className={`relative ${compact ? "h-6 w-9" : "h-8 w-11"} overflow-hidden rounded-md bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-600 ring-1 ring-amber-700/40`}>
          <div className="absolute inset-1 grid grid-cols-3 gap-px opacity-70">
            <div className="border border-amber-800/40" />
            <div className="border border-amber-800/40" />
            <div className="border border-amber-800/40" />
            <div className="border border-amber-800/40" />
            <div className="border border-amber-800/40" />
            <div className="border border-amber-800/40" />
          </div>
        </div>
      </div>

      {/* Card number */}
      <div className={`relative font-mono tabular-nums tracking-wider ${compact ? "px-3 pt-2 text-sm" : "px-4 pt-3 text-lg"}`}>
        {maskNumber(cardNumber, binNumber)}
      </div>

      {/* Bottom row: holder + expire + brand */}
      <div className={`relative flex items-end justify-between gap-2 ${compact ? "p-3 pt-2" : "p-4 pt-3"}`}>
        <div className="min-w-0">
          <div className={`font-mono uppercase opacity-70 ${compact ? "text-[8px]" : "text-[9px]"}`}>Card Holder</div>
          <div className={`truncate font-semibold uppercase tracking-wider ${compact ? "text-[11px]" : "text-xs"}`}>
            {holder || "—"}
          </div>
        </div>
        <div className="text-center">
          <div className={`font-mono uppercase opacity-70 ${compact ? "text-[8px]" : "text-[9px]"}`}>Valid</div>
          <div className={`font-mono ${compact ? "text-[11px]" : "text-xs"}`}>{expire || "••/••"}</div>
        </div>
        <div className="shrink-0">{brandMark(brand)}</div>
      </div>
    </div>
  );
}
