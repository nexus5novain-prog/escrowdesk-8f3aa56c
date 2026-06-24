// Free, public BIN/IIN lookup widget — works for guests and signed-in users.
// Talks to /api/payment-metadata which is public, cached and rate-limited.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Search, Sparkles, ShieldCheck, Globe2, Building2, Layers, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

type Metadata = {
  bin: string;
  network: string | null;
  brand: string | null;
  type: string | null;
  bank: string | null;
  country: string | null;
  country_code: string | null;
  source: string;
};

export function FreeBinLookup() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const digits = raw.replace(/\D/g, "");
  const canSearch = digits.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) {
      setError("Enter at least the first 6 digits of a card.");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const bin = digits.slice(0, 8);
      const res = await fetch(`/api/payment-metadata?bin=${bin}`);
      if (res.status === 429) throw new Error("Too many lookups — please wait a moment.");
      const body = (await res.json()) as { metadata: Metadata | null; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Lookup failed");
      setData(body.metadata);
      if (!body.metadata) setError("No record found for this BIN.");
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="bin-lookup"
      aria-labelledby="bin-lookup-title"
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/80 p-5 sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 0%, hsl(var(--primary)) 0, transparent 45%), radial-gradient(circle at 100% 100%, hsl(var(--accent)) 0, transparent 45%)",
        }}
      />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: pitch + form */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/50 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              <Sparkles className="mr-1 h-3 w-3" /> Free for everyone
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">No sign-up required</Badge>
          </div>
          <h2 id="bin-lookup-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Free <span className="text-primary">BIN / IIN</span> Lookup
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Identify the issuing bank, card network, type and country for any 6–8 digit BIN.
            Powered by our curated catalog — no account, no PAN, no CVV ever stored.
          </p>

          <form onSubmit={submit} className="space-y-2">
            <label htmlFor="bin-input" className="sr-only">BIN or IIN</label>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-1.5 focus-within:border-primary">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <Input
                id="bin-input"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="e.g. 414720 or 4147 20"
                inputMode="numeric"
                autoComplete="off"
                maxLength={19}
                className="h-10 border-0 bg-transparent font-mono text-base shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="sm" disabled={loading || !canSearch} className="gap-1.5">
                <Search className="h-3.5 w-3.5" /> {loading ? "Looking up…" : "Lookup"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              We only need the first 6–8 digits. Full card numbers are never transmitted or stored.
            </p>
          </form>

          <ul className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> Privacy-safe</li>
            <li className="flex items-center gap-1.5"><Globe2 className="h-3 w-3 text-primary" /> Global coverage</li>
            <li className="flex items-center gap-1.5"><Banknote className="h-3 w-3 text-primary" /> Issuer + country</li>
            <li className="flex items-center gap-1.5"><Layers className="h-3 w-3 text-primary" /> Network + type</li>
          </ul>
        </div>

        {/* Right: result panel */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {!searched && !data && !error && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid h-full place-items-center rounded-xl border border-dashed border-border/70 bg-background/30 p-6 text-center"
              >
                <div>
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-background/60">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Enter a BIN to begin</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try common test BINs: <button type="button" onClick={() => setRaw("414720")} className="font-mono text-primary hover:underline">414720</button>{" "}
                    · <button type="button" onClick={() => setRaw("531869")} className="font-mono text-primary hover:underline">531869</button>{" "}
                    · <button type="button" onClick={() => setRaw("371449")} className="font-mono text-primary hover:underline">371449</button>
                  </p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                key={`err-${error}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid h-full place-items-center rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center"
              >
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}

            {data && !error && (
              <motion.div
                key={`res-${data.bin}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-3 rounded-xl border border-primary/30 bg-background/50 p-4"
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">BIN</p>
                      <p className="font-mono text-base font-semibold">{data.bin}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {data.source}
                  </Badge>
                </header>

                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <Field icon={Layers} label="Network" value={data.network} />
                  <Field icon={CreditCard} label="Type" value={data.type} />
                  <Field icon={Building2} label="Brand" value={data.brand} />
                  <Field icon={Banknote} label="Issuer" value={data.bank} />
                  <Field
                    icon={Globe2}
                    label="Country"
                    value={data.country ? `${data.country}${data.country_code ? ` (${data.country_code})` : ""}` : null}
                    className="col-span-2 sm:col-span-1"
                  />
                </div>

                <p className="pt-1 text-[11px] text-muted-foreground">
                  Need full PAN, CVV or expiry for trading? Those are released inside an escrow trade room after a buyer funds the deposit. <a href="/marketplace" className="text-primary hover:underline">Browse marketplace →</a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Field({ icon: Icon, label, value, className }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border/60 bg-background/40 p-2.5", className)}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}
