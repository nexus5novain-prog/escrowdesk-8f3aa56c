import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/escrow.functions";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileNav } from "@/components/MobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import logoAsset from "@/assets/escrowdesk-logo.png.asset.json";
import { BRAND } from "@/lib/brand";

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

  const linkCls = "px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = "px-3 py-2 text-sm font-medium text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:h-14 sm:px-4 sm:py-0">
        {/* Logo */}
        <Link to="/" className="flex flex-shrink-0 items-center gap-2">
          <img src={logoAsset.url} alt={BRAND.core} className="h-8 w-auto" />
          <span className="hidden flex-col leading-tight md:flex">
            <span className="text-[13px] font-semibold tracking-tight">{BRAND.core}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary/80">Secure every transaction</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 sm:flex lg:gap-1">
          <Link to="/marketplace" className={linkCls} activeProps={{ className: activeCls }}>Marketplace</Link>
          <Link to="/escrow-portal" className={linkCls} activeProps={{ className: activeCls }}>Escrow Portal</Link>
          <Link to="/order-book" className={linkCls} activeProps={{ className: activeCls }}>P2P</Link>
          {user && (
            <>
              <Link to="/trades" className={linkCls} activeProps={{ className: activeCls }}>Trades</Link>
              <Link to="/wallet" className={linkCls} activeProps={{ className: activeCls }}>Wallet</Link>
              <Link to="/settings" className={linkCls} activeProps={{ className: activeCls }}>Settings</Link>
              {isStaff && (
                <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>Admin</Link>
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
