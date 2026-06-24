import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-5">
      {/* live animated halo */}
      <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl animate-pulse [animation-delay:1.2s]" />
      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
            <Mail className="h-4 w-4 animate-bounce [animation-duration:2.4s]" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Join the EscrowDesk newsletter</h3>
            <p className="text-xs text-muted-foreground">Product updates, security advisories and top deals — straight to your inbox.</p>
          </div>
        </div>
        <form
          className="flex w-full max-w-sm items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await subscribe({ data: { email, source } });
              setDone(true);
              setEmail("");
              toast.success("Subscribed");
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            type="email" required value={email} disabled={busy || done}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-background/80"
          />
          <Button type="submit" disabled={busy || done} className="shrink-0">
            {done ? <CheckCircle2 className="h-4 w-4" /> : busy ? "…" : (<><Send className="mr-1 h-3.5 w-3.5" /> Subscribe</>)}
          </Button>
        </form>
      </div>
    </section>
  );
}
