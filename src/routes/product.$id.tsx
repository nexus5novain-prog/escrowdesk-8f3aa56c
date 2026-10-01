import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { getProduct, buyProduct } from "@/lib/products.functions";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryPlaceholder } from "@/components/CategoryPlaceholder";
import { fmtFiat } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, ShieldCheck, Sparkles, Star, Wallet } from "lucide-react";

function maskCardNumber(num: string) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 6) return num;
  const visible = digits.slice(0, 6);
  return `${visible} **** **** ****`;
}

export const Route = createFileRoute("/product/$id")({
  component: ProductDetailPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="surface mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Product unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
          <Button asChild><Link to="/marketplace">Back to marketplace</Link></Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="surface mx-auto max-w-md p-6 text-center">
      <h1 className="text-lg font-semibold">Product not found</h1>
      <Button asChild className="mt-4"><Link to="/marketplace">Back to marketplace</Link></Button>
    </div>
  ),
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const fetchFn = useServerFn(getProduct);
  const buyFn = useServerFn(buyProduct);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="surface p-10 text-center text-sm text-muted-foreground">Unable to load product.</div>;
  }

  const p = data.product;
  const long = (p.description ?? "").length > 280;
  const shown = expanded || !long ? p.description : p.description.slice(0, 280) + "…";

  const buy = async () => {
    if (!user) return nav({ to: "/auth" });
    setBusy(true);
    try {
      const r = await buyFn({ data: { id: p.id } });
      toast.success("Escrow trade opened");
      nav({ to: "/trade/$id", params: { id: r.trade_id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/marketplace"><ArrowLeft className="mr-1 h-4 w-4" /> Back to marketplace</Link>
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 md:grid-cols-2">
        <div className="surface overflow-hidden">
          <div className="relative aspect-square w-full bg-secondary/30">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <CategoryPlaceholder category={p.category} name={p.name} />
            )}
            {p.is_featured && (
              <Badge className="absolute left-3 top-3 gap-1"><Star className="h-3 w-3" /> Featured</Badge>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Badge variant="outline">{p.category}</Badge>
            <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{p.name}</h1>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-mono text-3xl text-primary">{fmtFiat(Number(p.price), p.currency)}</span>
              <Badge variant="secondary" className="mb-1.5"><Wallet className="mr-1 h-3 w-3" />Pay in {p.seller_wallet_asset ?? "USDT"}</Badge>
              <Badge variant={p.status === "active" ? "default" : "secondary"} className="mb-1.5">{p.status}</Badge>
            </div>
            {(p.bin_number || p.card_bank || p.card_type || p.card_user) && (
              <div className="mt-4 rounded-2xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
                {p.card_user && <div className="font-medium text-foreground">{p.card_user}</div>}
                {p.bin_number && (
                  <div className="mt-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {`${p.bin_number} **** **** ****`}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  {[p.card_bank, p.card_type, p.card_brand, p.card_country].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">Full PAN, CVV & billing address unlock inside escrow after purchase.</div>
              </div>
            )}
          </div>

          <div className="surface p-4">
            <h2 className="text-sm font-semibold">About this product</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{shown}</p>
            {long && (
              <button onClick={() => setExpanded((x) => !x)} className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline">
                {expanded ? <>Show less <ChevronUp className="ml-1 h-3 w-3" /></> : <>Read more <ChevronDown className="ml-1 h-3 w-3" /></>}
              </button>
            )}
          </div>

          <div className="surface flex items-center gap-3 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Your payment is held in escrow. Funds release only when you confirm delivery.</span>
          </div>

          <Button size="lg" className="w-full" onClick={buy} disabled={busy || p.status !== "active"}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {p.status === "active" ? `Buy now — ${fmtFiat(Number(p.price), p.currency)}` : "Unavailable"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
