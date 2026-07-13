import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  user: any;
  isStaff: boolean;
  onSignOut: () => void;
}

export function MobileNav({ user, isStaff, onSignOut }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  const navItems = [
    { label: "Home", to: "/", icon: "🏠" },
    { label: "Marketplace (Declutter)", to: "/marketplace", icon: "🛍️" },
    { label: "Escrow Portal", to: "/escrow-portal", icon: "🛡️" },
    { label: "P2P Order-book", to: "/order-book", icon: "📊" },
    ...(user ? [
      { label: "My Threads", to: "/my-threads", icon: "📝" },
      { label: "Trades", to: "/trades", icon: "📈" },
      { label: "Wallet", to: "/wallet", icon: "💰" },
      { label: "Transactions", to: "/transactions", icon: "💳" },
      { label: "Settings", to: "/settings", icon: "⚙️" },
      ...(isStaff ? [{ label: "Admin", to: "/admin", icon: "👨‍💼" }] : []),
    ] : []),
  ];

  return (
    <div className="sm:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-14 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <nav className="flex flex-col py-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeMenu}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary"
                activeProps={{ className: "flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground bg-secondary/50" }}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            <div className="border-t border-border/60 py-2">
              {user ? (
                <Button
                  onClick={() => {
                    onSignOut();
                    closeMenu();
                  }}
                  variant="ghost"
                  className="w-full justify-start rounded-none px-4 py-3 text-sm font-medium"
                >
                  Sign out
                </Button>
              ) : (
                <Link to="/auth" onClick={closeMenu} className="block">
                  <Button className="w-full">Sign in</Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 animate-in fade-in duration-300"
          onClick={closeMenu}
        />
      )}
    </div>
  );
}
