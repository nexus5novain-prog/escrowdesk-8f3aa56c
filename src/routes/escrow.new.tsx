import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/escrow/new")({
  head: () => ({ meta: [{ title: "Escrow groups deprecated — EscrowDesk" }] }),
  component: DeprecatedNewEscrow,
});

function DeprecatedNewEscrow() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card className="space-y-4 border-amber-500/40 bg-amber-500/5 p-6">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Legacy escrow groups are deprecated</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The off-ledger "escrow groups" flow has been retired because it operated outside
          the platform's ledger. All new escrow trades now run through the ledger-backed
          flow with proper double-entry accounting, reconciliation, and dispute support.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/order-book">Browse the order book</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/trades">View your trades</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
