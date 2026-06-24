import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSupportTicket } from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LifeBuoy, Mail } from "lucide-react";
import { toast } from "sonner";

export function SupportForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const submit = useServerFn(createSupportTicket);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="surface mt-10 p-6">
      <div className="flex items-start gap-3">
        <LifeBuoy className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Need help? Contact support</h2>
          <p className="text-xs text-muted-foreground">
            Send us a message and our team will reply by in-app notification — usually within a few hours.
            Prefer email? <a href="mailto:support@escrowdesk.app" className="text-primary underline">support@escrowdesk.app</a>.
          </p>
        </div>
      </div>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await submit({ data: { email, subject, message } });
            toast.success("Support ticket sent");
            setSubject(""); setMessage("");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Your email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject</Label>
          <Input required maxLength={160} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Message</Label>
          <Textarea required maxLength={4000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what's happening…" />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between gap-3">
          <a href="mailto:support@escrowdesk.app" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5" /> or send us an email
          </a>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send to support"}</Button>
        </div>
      </form>
    </section>
  );
}
