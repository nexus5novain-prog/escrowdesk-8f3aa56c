import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/escrow.functions";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileNav } from "@/components/MobileNav";
import { NotificationBell } from "@/components/NotificationBell";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const fetchRoles = useServerFn(getMyRoles);
  const qc = useQueryClient();
  const { data: rolesData } = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: () => fetchRoles(),
    enabled: !!user,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`header-roles-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-roles", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);
  const isStaff = (rolesData?.roles ?? []).some((r) => r === "admin" || r === "moderator");
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:h-14 sm:px-4 sm:py-0">
        {/* Logo */}
        <Link to="/" className="flex flex-shrink-0 items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="hidden font-semibold tracking-tight sm:inline">EscrowDesk</span>
          <span className="ml-2 hidden rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
            P2P · Telegram
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center gap-1 sm:flex md:gap-2">
          <Link to="/" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Home</Link>
          <Link to="/marketplace" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Marketplace</Link>
          <Link to="/order-book" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Threads</Link>
          {user && (
            <>
              <Link to="/trades" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Trades</Link>
              <Link to="/disputes" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Disputes</Link>
              <Link to="/escrow/new" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Escrow</Link>
              <Link to="/wallet" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Wallet</Link>
              <Link to="/transactions" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Transactions</Link>
              <Link to="/settings" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Settings</Link>
              {isStaff && (
                <Link to="/admin" className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}>Admin</Link>
              )}
            </>
          )}
        </nav>

        {/* Desktop Auth Button */}
        <div className="hidden gap-2 sm:flex sm:flex-shrink-0 sm:items-center">
          {user && <NotificationBell />}
          {user ? (
            <Button size="sm" variant="ghost" onClick={() => signOut()}>Sign out</Button>
          ) : (
            <Link to="/auth"><Button size="sm" variant="default">Sign in</Button></Link>
          )}
        </div>

        {/* Mobile Navigation */}
        <MobileNav user={user} isStaff={isStaff} onSignOut={signOut} />
      </div>
    </header>
  );
}
