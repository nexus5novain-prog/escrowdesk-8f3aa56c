import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortfolioStat = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: "primary" | "emerald" | "amber" | "rose" | "sky" | "violet";
};

// Professional accent ring colors (subtle, business-like)
const accentRing: Record<NonNullable<PortfolioStat["accent"]>, string> = {
  primary: "border-l-primary",
  emerald: "border-l-success",
  amber:   "border-l-warning",
  rose:    "border-l-destructive",
  sky:     "border-l-accent",
  violet:  "border-l-secondary",
};

export function PortfolioHero({
  eyebrow, title, subtitle, stats, icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats: PortfolioStat[];
  /** Deprecated: kept for compatibility; ignored in the new professional treatment. */
  gradient?: string;
  icon?: LucideIcon;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 md:p-7 shadow-sm"
    >
      {/* subtle top accent rule in primary (gold) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">{eyebrow}</p>
          )}
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-[1.75rem]">{title}</h1>
          </div>
          {subtitle && <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stats.map((s, i) => (
            <motion.div
              key={`${s.label}-${i}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
              className={cn(
                "group relative rounded-md border border-border/70 bg-background/40 p-3 backdrop-blur-sm",
                "border-l-4 transition-colors hover:bg-background/60",
                accentRing[s.accent ?? "primary"],
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.label}</span>
                {s.icon && <s.icon className="h-3.5 w-3.5 text-muted-foreground/70" />}
              </div>
              <div className="mt-1.5 truncate text-lg font-semibold tabular-nums text-foreground md:text-xl">{s.value}</div>
              {s.hint && <div className="text-[10px] text-muted-foreground">{s.hint}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
