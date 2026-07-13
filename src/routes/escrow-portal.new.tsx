import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { ESCROW_DEAL_TYPES, type EscrowDealType } from "@/lib/brand";
import { createEscrowDeal } from "@/lib/escrow-portal.functions";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/escrow-portal/new")({
  head: () => ({ meta: [{ title: "Create Escrow — Novain Escrowdesk" }] }),
  component: CreateEscrow,
});

function CreateEscrow() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createEscrowDeal);

  const [dealType, setDealType] = useState<EscrowDealType>("product");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BTC");
  const [role, setRole] = useState<"buyer" | "seller">("seller"); // "I am the seller"
  const [cpEmail, setCpEmail] = useState("");
  const [location, setLocation] = useState<LocationValue>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) {
      toast.error("Title and amount are required");
      return;
    }
    setSubmitting(true);
    try {
      const counterpartyRole = role === "seller" ? "buyer" : "seller";
      const deal = await create({
        data: {
          deal_type: dealType,
          title: title.trim(),
          description,
          terms,
          amount: parseFloat(amount),
          currency,
          counterparty_role: counterpartyRole,
          counterparty_email: cpEmail || null,
          location_country: location.country ?? null,
          location_state: location.state ?? null,
          location_city: location.city ?? null,
        },
      });
      toast.success("Escrow created");
      navigate({ to: "/escrow-portal/$dealId", params: { dealId: deal.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create escrow");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
          Escrow Portal
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Create a new escrow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the deal, then invite your counterparty by secure link.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Deal type</Label>
            <Select value={dealType} onValueChange={(v) => setDealType(v as EscrowDealType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {ESCROW_DEAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <div className="font-medium">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sale of domain example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's being exchanged and any details both parties should know."
              rows={3}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>My role</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as "buyer" | "seller")} className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 p-3 hover:bg-muted/40">
                <RadioGroupItem value="seller" id="r-seller" />
                <div><div className="text-sm font-medium">I am the seller</div><div className="text-[11px] text-muted-foreground">Buyer will fund the escrow.</div></div>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 p-3 hover:bg-muted/40">
                <RadioGroupItem value="buyer" id="r-buyer" />
                <div><div className="text-sm font-medium">I am the buyer</div><div className="text-[11px] text-muted-foreground">I will fund the escrow.</div></div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Counterparty email <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              type="email"
              value={cpEmail}
              onChange={(e) => setCpEmail(e.target.value)}
              placeholder="counterparty@example.com — helps us email the invite link"
            />
            <p className="text-[11px] text-muted-foreground">You'll always get a shareable link — the email is a convenience.</p>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <LocationPicker value={location} onChange={setLocation} />
        </Card>

        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Terms &amp; delivery conditions</Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={5}
              placeholder="Delivery deadline, acceptance criteria, inspection window, cancellation rules…"
            />
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Funds are locked until both parties sign off. Disputes go to a Novain mediator.
          </p>
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? "Creating…" : "Create escrow & get invite link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
