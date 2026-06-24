import { Link, useLocation } from "@tanstack/react-router";
import { Handshake, Gavel } from "lucide-react";

export function TradesSubNav() {
  const { pathname } = useLocation();
  const items = [
    { to: "/trades", label: "Trades", icon: Handshake },
    { to: "/disputes", label: "Disputes", icon: Gavel },
  ] as const;
  return (
    <nav className="surface flex flex-wrap items-center gap-1 p-1">
      {items.map((it) => {
        const active = it.to === "/trades"
          ? pathname === "/trades"
          : pathname.startsWith("/disputes");
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
