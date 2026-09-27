import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Github } from "lucide-react";
import { AdBanner } from "@/components/AdBanner";
import { NewsletterForm } from "@/components/NewsletterForm";
import logoAsset from "@/assets/escrowdesk-logo.png.asset.json";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border/70 bg-card/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Footer ad slot */}
        <AdBanner placement="footer" variant="card" className="mb-8 block" />

        <NewsletterForm source="footer" />


        <div className="mt-8 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={logoAsset.url}
                alt="EscrowDesk"
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Professional peer-to-peer crypto escrow. Every trade is mediated, signed and settled on-platform.
            </p>
          </div>

          <FooterCol title="Marketplace">
            <FooterLink to="/marketplace">All stores</FooterLink>
            <FooterLink to="/order-book">Threads</FooterLink>
            <FooterLink to="/post-listing">Post a listing</FooterLink>
            <FooterLink to="/post-offer">Post an offer</FooterLink>
          </FooterCol>

          <FooterCol title="Account">
            <FooterLink to="/wallet">Wallet</FooterLink>
            <FooterLink to="/trades">My trades</FooterLink>
            <FooterLink to="/transactions">Transactions</FooterLink>
            <FooterLink to="/settings">Settings</FooterLink>
          </FooterCol>

          <FooterCol title="Contact">
            <a href="mailto:support@escrowdesk.app" className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> support@escrowdesk.app
            </a>
            <a href="https://t.me/EscrowDeskBot" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Telegram bot
            </a>
            <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            © {year} EscrowDesk. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
