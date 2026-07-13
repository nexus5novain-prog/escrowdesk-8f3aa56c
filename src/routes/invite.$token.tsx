import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Handshake } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { previewEscrowInvite, acceptEscrowInvite } from "@/lib/escrow-portal.functions";
import { ESCROW_DEAL_TYPES } from "@/lib/brand";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [
    { title: "You've been invited — Novain Escrowdesk" },
    { name: "robots", content: "noindex" },
  ] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const preview = useServerFn(previewEscrowInvite);
  const accept = useServerFn(acceptEscrowInvite);

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => preview({ data: { token } }),
    enabled: !!user,
    retry: false,
  });

  const [accepting, setAccepting] = useState(false);

  // Stash token so /auth can return here after sign-up
  useEffect(() => {
    if (!user && !loading && typeof window !== "undefined") {
      sessionStorage.setItem("pending_invite_token", token);
    }
  }, [user, loading, token]);

  if (loading) {
    return <Card className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">Loading…</Card>;
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Handshake className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">You've been invited to an escrow deal</h1>
        <p className="text-sm text-muted-foreground">
          Sign up or sign in on Novain Escrowdesk to review the terms and accept the invitation.
          Your invite link is saved for you.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to="/auth">Sign up / Sign in to continue</Link>
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return <Card className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">Loading invite…</Card>;
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <h1 className="text-lg font-semibold">Invite unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "This invite link is invalid, used, or expired."}
        </p>
        <Button asChild variant="outline"><Link to="/">Return home</Link></Button>
      </Card>
    );
  }

  const { invite, deal } = data;
  const typeLabel = deal ? ESCROW_DEAL_TYPES.find((t) => t.value === deal.deal_type)?.label ?? deal.deal_type : "";

  const doAccept = async () => {
    setAccepting(true);
    try {
      const res = await accept({ data: { token } });
      sessionStorage.removeItem("pending_invite_token");
      toast.success("Invite accepted");
      navigate({ to: "/escrow-portal/$dealId", params: { dealId: res.deal_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Invitation to an escrow deal</h1>
      </div>

      {deal && (
        <div className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{deal.reference}</span>
            <Badge variant="secondary">{typeLabel}</Badge>
            <Badge variant="outline" className="capitalize">as {invite.role}</Badge>
          </div>
          <p className="font-medium">{deal.title}</p>
          {deal.description && <p className="text-sm text-muted-foreground">{deal.description}</p>}
          <p className="font-mono text-sm">
            {Number(deal.amount).toFixed(deal.currency === "BTC" ? 8 : 2)} {deal.currency}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        By accepting, you agree to be a party to this escrow. Funds will be held until both sides sign off,
        or a mediator resolves a dispute.
      </p>

      <Button onClick={doAccept} disabled={accepting || !!invite.accepted_at} size="lg" className="w-full">
        {invite.accepted_at ? "Already accepted" : accepting ? "Accepting…" : "Accept invitation"}
      </Button>
    </Card>
  );
}
