import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Share2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getEscrowDeal, createEscrowInvite } from "@/lib/escrow-portal.functions";
import { ESCROW_DEAL_TYPES } from "@/lib/brand";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/escrow-portal/$dealId")({
  head: () => ({ meta: [{ title: "Escrow Deal — Novain Escrowdesk" }] }),
  component: DealDetail,
});

function DealDetail() {
  const { dealId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDeal = useServerFn(getEscrowDeal);
  const invite = useServerFn(createEscrowInvite);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["escrow-deal", dealId],
    queryFn: () => fetchDeal({ data: { id: dealId } }),
    enabled: !!user,
  });

  const [inviteRole, setInviteRole] = useState<"buyer" | "seller" | "observer">("buyer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const genInvite = async () => {
    setCreating(true);
    try {
      await invite({
        data: {
          deal_id: dealId,
          role: inviteRole,
          invited_email: inviteEmail || null,
        },
      });
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["escrow-deal", dealId] });
      toast.success("Invite link created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  if (isLoading || !data) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading deal…</Card>;
  }

  const { deal, invites } = data;
  const typeLabel = ESCROW_DEAL_TYPES.find((t) => t.value === deal.deal_type)?.label ?? deal.deal_type;
  const isCreator = deal.creator_id === user?.id;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{deal.reference}</span>
          <Badge variant="secondary">{typeLabel}</Badge>
          <Badge variant="outline" className="capitalize">{deal.status.replace("_", " ")}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{deal.title}</h1>
        {deal.description && <p className="mt-1 text-sm text-muted-foreground">{deal.description}</p>}
      </div>

      <Card className="grid gap-3 p-5 sm:grid-cols-2">
        <Kv label="Amount" value={`${Number(deal.amount).toFixed(deal.currency === "BTC" ? 8 : 2)} ${deal.currency}`} />
        <Kv label="Created" value={formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })} />
        <Kv label="Buyer" value={deal.buyer_id ? "Assigned" : deal.buyer_email || "Pending invite"} />
        <Kv label="Seller" value={deal.seller_id ? "Assigned" : deal.seller_email || "Pending invite"} />
        {(deal.location_country || deal.location_state || deal.location_city) && (
          <Kv label="Location" value={[deal.location_city, deal.location_state, deal.location_country].filter(Boolean).join(", ")} />
        )}
      </Card>

      {isCreator && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Invite counterparty</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email (optional)</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="counterparty@example.com"
              />
            </div>
            <Button onClick={genInvite} disabled={creating}>
              {creating ? "Creating…" : "Create invite"}
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active invites</p>
              {invites.map((iv) => (
                <InviteRow key={iv.id} invite={iv} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function InviteRow({ invite }: { invite: { id: string; token: string; role: string; invited_email: string | null; accepted_at: string | null; expires_at: string } }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/invite/${invite.token}` : `/invite/${invite.token}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const expired = new Date(invite.expires_at).getTime() < Date.now();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/40 p-3">
      <Badge variant="outline" className="capitalize">{invite.role}</Badge>
      {invite.invited_email && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3" /> {invite.invited_email}
        </span>
      )}
      <div className="flex-1 min-w-0 font-mono text-[11px] text-muted-foreground truncate">{url}</div>
      {invite.accepted_at ? (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400" variant="secondary">Accepted</Badge>
      ) : expired ? (
        <Badge variant="destructive">Expired</Badge>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
        </span>
      )}
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
