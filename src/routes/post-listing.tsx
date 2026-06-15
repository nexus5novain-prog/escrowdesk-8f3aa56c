import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createListing } from "@/lib/marketplace.functions";
import { getMe } from "@/lib/escrow.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace-categories";
import { toast } from "sonner";
import { ShoppingBag, Search, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/post-listing")({
  component: () => (<AuthGate><Page /></AuthGate>),
});

type Kind = "selling" | "seeking";

function Page() {
  const nav = useNavigate();
  const fn = useServerFn(createListing);
  const fetchMe = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<Kind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    name: "", description: "", category: "", amount: "", currency: "USD",
    contact_telegram: "", contact_website: "",
  });

  // Prefill telegram from the linked profile
  useEffect(() => {
    const tg = (me?.profile as { telegram_username?: string | null } | undefined)?.telegram_username;
    if (tg && !f.contact_telegram) setF((x) => ({ ...x, contact_telegram: tg.startsWith("@") ? tg : `@${tg}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setSubmitting(true);
    try {
      await fn({ data: {
        kind,
        name: f.name,
        description: f.description,
        category: f.category,
        amount: kind === "selling" && f.amount ? Number(f.amount) : null,
        currency: f.currency || "USD",
        contact_telegram: f.contact_telegram || undefined,
        contact_website: f.contact_website || undefined,
      }});
      toast.success("Thread published");
      nav({ to: "/order-book" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 sm:px-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/order-book" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">← Back to threads</Link>
        <Badge variant="outline" className="font-mono text-[10px] w-fit">Step {step} of 2</Badge>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="surface space-y-4 p-4 sm:p-6">
            <h1 className="text-lg sm:text-xl font-semibold">What kind of thread are you posting?</h1>
            <p className="text-sm text-muted-foreground">Pick one to continue.</p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <KindCard active={kind === "selling"} onClick={() => setKind("selling")} icon={<ShoppingBag className="h-5 w-5" />} title="I'm selling" desc="Offer a product or asset for sale." />
              <KindCard active={kind === "seeking"} onClick={() => setKind("seeking")} icon={<Search className="h-5 w-5" />} title="I'm seeking" desc="Looking for a product or service." />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => kind && setStep(2)} disabled={!kind} className="gap-2 w-full sm:w-auto">Continue <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}

        {step === 2 && kind && (
          <motion.form key="step2" onSubmit={submit} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="surface space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-lg sm:text-xl font-semibold">{kind === "selling" ? "Selling details" : "Seeking details"}</h1>
              <Badge variant="secondary" className="font-mono text-[10px] w-fit">{kind.toUpperCase()}</Badge>
            </div>

            <div className="grid gap-3">
              <Field label={kind === "selling" ? "Product name" : "Service name"}>
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={kind === "selling" ? "e.g. iPhone 15 Pro 256GB" : "e.g. Logo designer for fintech startup"} required maxLength={120} className="text-sm" />
              </Field>
              <Field label="Description">
                <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={kind === "selling" ? "Condition, specs, why you're selling…" : "Scope, deadline, budget hints, must-haves…"} required maxLength={2000} rows={4} className="text-sm" />
              </Field>
              <Field label="Category">
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>
                    {MARKETPLACE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {kind === "selling" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2"><Field label="Amount"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="e.g. 950.00" className="text-sm" /></Field></div>
                  <Field label="Currency"><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} placeholder="USD" maxLength={8} className="text-sm" /></Field>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Telegram contact (optional)"><Input value={f.contact_telegram} onChange={(e) => setF({ ...f, contact_telegram: e.target.value })} placeholder="@yourhandle" maxLength={60} className="text-sm" /></Field>
                <Field label="Website / link (optional)"><Input value={f.contact_website} onChange={(e) => setF({ ...f, contact_website: e.target.value })} placeholder="https://…" maxLength={200} className="text-sm" /></Field>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2 w-full sm:w-auto justify-center"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button type="submit" disabled={submitting} className="gap-2 w-full sm:w-auto justify-center">
                <CheckCircle2 className="h-4 w-4" /> {submitting ? "Publishing…" : "Publish thread"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function KindCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className={`text-left rounded-lg border p-4 sm:p-5 transition-colors min-h-[120px] flex flex-col justify-between ${active ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:bg-secondary/40"}`}>
      <div>
        <div className="mb-2 grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">{icon}</div>
        <div className="font-semibold text-sm sm:text-base">{title}</div>
      </div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </motion.button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
