import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  adminListDisputes, adminResolveDispute, adminSetFee, adminMakeMeAdmin, getMe,
  adminListOffers, adminUpdateOfferStatus,
  adminListTrades, adminForceCancelTrade, adminForceReleaseTrade,
  tgGetStatus, tgSetWebhook, tgDeleteWebhook, tgSendTest,
  adminListUsers, adminBanUser, adminUnbanUser, adminWarnUser,
  adminAssignRole, adminRevokeRole, adminUnlinkTelegram, adminListWarnings,
  getCompanyEscrowAddresses, adminSetCompanyEscrowAddresses,
} from "@/lib/escrow.functions";
import { listSupportTickets, respondToSupportTicket } from "@/lib/support.functions";
import { listNewsletterSubscribers, broadcastNewsletter } from "@/lib/newsletter.functions";
import { adminListAnnouncements, adminCreateAnnouncement, adminToggleAnnouncement, adminDeleteAnnouncement } from "@/lib/announcements.functions";
import { adminSendUserMessage, adminListUsersLite } from "@/lib/admin-broadcast.functions";
import { adminListAds, adminCreateAd, adminUpdateAd, adminDeleteAd, adminAdAnalytics, adminAdHealth, type AdPlacement } from "@/lib/ads.functions";
import { adminListShouts, adminReviewShout, adminSetShoutboxBtc, adminTogglePin, adminToggleHide, getShoutboxConfig, type ShoutMsg } from "@/lib/shoutbox.functions";
import { adminListProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminSeedSampleProducts, lookupBinMetadata } from "@/lib/products.functions";
import { adminListThreads, adminSetThreadStatus, adminDeleteThread } from "@/lib/marketplace.functions";
import { ArbitrationPanel } from "@/components/admin/ArbitrationPanel";
import { WithdrawalsPanel } from "@/components/admin/WithdrawalsPanel";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "@/lib/marketplace-categories";
import { THREAD_SECTIONS, sectionOf } from "@/lib/thread-categories";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ArrowUpRight, CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { AdSizePicker } from "@/components/admin/AdSizePicker";
import { BinAdminPanel } from "@/components/admin/BinAdminPanel";

export const Route = createFileRoute("/admin")({ component: () => (<AuthGate><Admin /></AuthGate>) });

function Admin() {
  const fetchMe = useServerFn(getMe);
  const { data: me, refetch: refetchMe } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const isStaff = me?.roles.some((r) => r === "admin" || r === "moderator") ?? false;
  const promote = useServerFn(adminMakeMeAdmin);

  if (!isStaff) {
    return (
      <div className="surface mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">You're not a staff member. If no admin exists, you can claim the first admin role.</p>
        <Button className="mt-4" onClick={async () => { try { await promote(); toast.success("You're admin"); refetchMe(); } catch (e) { toast.error((e as Error).message); } }}>Claim admin</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <Tabs defaultValue="disputes">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="arbitration">Arbitration</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="threads">Threads</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="shoutbox">Shoutbox</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="bins">BIN Catalog</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="disputes" className="mt-4"><DisputesPanel /></TabsContent>
        <TabsContent value="arbitration" className="mt-4"><ArbitrationPanel /></TabsContent>
        <TabsContent value="offers" className="mt-4"><OffersPanel /></TabsContent>
        <TabsContent value="withdrawals" className="mt-4"><WithdrawalsPanel /></TabsContent>
        <TabsContent value="trades" className="mt-4"><TradesPanel /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
        <TabsContent value="warnings" className="mt-4"><WarningsPanel /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsPanel /></TabsContent>
        <TabsContent value="threads" className="mt-4"><ThreadsPanel /></TabsContent>
        <TabsContent value="ads" className="mt-4"><AdsPanel /></TabsContent>
        <TabsContent value="shoutbox" className="mt-4"><ShoutboxPanel /></TabsContent>
        <TabsContent value="telegram" className="mt-4"><TelegramPanel /></TabsContent>
        <TabsContent value="support" className="mt-4"><SupportPanel /></TabsContent>
        <TabsContent value="announcements" className="mt-4"><AnnouncementsPanel /></TabsContent>
        <TabsContent value="broadcast" className="mt-4"><BroadcastPanel /></TabsContent>
        <TabsContent value="newsletter" className="mt-4"><NewsletterPanel /></TabsContent>
        <TabsContent value="bins" className="mt-4"><BinAdminPanel /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function DisputesPanel() {
  const listD = useServerFn(adminListDisputes);
  const resolve = useServerFn(adminResolveDispute);
  const { data: raw, refetch } = useQuery({ queryKey: ["disputes"], queryFn: () => listD() });
  const data = raw as { disputes: Array<{ id: string; trade_id: string; reason: string; status: string; created_at: string }> } | undefined;
  const [filter, setFilter] = useState<string>("open");
  const rows = (data?.disputes ?? []).filter((d) => filter === "all" || d.status === filter);
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Disputes</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved_buyer">Resolved → buyer</SelectItem>
            <SelectItem value="resolved_seller">Resolved → seller</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((d) => (
          <div key={d.id} className="rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Trade <Link to="/trade/$id" params={{ id: d.trade_id }} className="font-mono underline">{d.trade_id.slice(0,8)}</Link> · {new Date(d.created_at).toLocaleString()}</span>
              <Badge variant={d.status === "open" ? "destructive" : "secondary"}>{d.status}</Badge>
            </div>
            <p className="mt-1 text-sm">{d.reason}</p>
            {d.status === "open" && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={async () => { try { await resolve({ data: { trade_id: d.trade_id, award_to: "buyer", note: "" } }); toast.success("Resolved → buyer"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Award buyer</Button>
                <Button size="sm" variant="outline" onClick={async () => { try { await resolve({ data: { trade_id: d.trade_id, award_to: "seller", note: "" } }); toast.success("Resolved → seller"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Award seller</Button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No disputes.</div>}
      </div>
    </div>
  );
}

function OffersPanel() {
  const listO = useServerFn(adminListOffers);
  const updateO = useServerFn(adminUpdateOfferStatus);
  const [status, setStatus] = useState<string>("all");
  const { data, refetch } = useQuery({
    queryKey: ["admin-offers", status],
    queryFn: () => listO({ data: status === "all" ? {} : { status: status as "active"|"paused"|"closed" } }),
  });
  const offers = (data as { offers: Array<{ id: string; side: string; asset: string; fiat_currency: string; price: number; min_amount: number; max_amount: number; available_crypto: number; status: string; maker_name: string | null; created_at: string }> } | undefined)?.offers ?? [];
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Offers</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="text-left py-2">ID</th><th className="text-left">Maker</th><th className="text-left">Side</th><th className="text-left">Asset</th><th className="text-right">Price</th><th className="text-right">Min/Max</th><th className="text-right">Avail</th><th className="text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-border/40">
                <td className="py-2 font-mono">{o.id.slice(0,8)}</td>
                <td>{o.maker_name ?? "—"}</td>
                <td className="uppercase">{o.side}</td>
                <td>{o.asset}/{o.fiat_currency}</td>
                <td className="text-right font-mono">{Number(o.price).toFixed(2)}</td>
                <td className="text-right font-mono">{Number(o.min_amount).toFixed(0)}–{Number(o.max_amount).toFixed(0)}</td>
                <td className="text-right font-mono">{Number(o.available_crypto).toFixed(4)}</td>
                <td><Badge variant={o.status === "active" ? "default" : "secondary"}>{o.status}</Badge></td>
                <td className="text-right">
                  <Select value={o.status} onValueChange={async (v) => { try { await updateO({ data: { id: o.id, status: v as "active"|"paused"|"closed" } }); toast.success("Updated"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {offers.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No offers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradesPanel() {
  const listT = useServerFn(adminListTrades);
  const cancel = useServerFn(adminForceCancelTrade);
  const release = useServerFn(adminForceReleaseTrade);
  const [status, setStatus] = useState<string>("all");
  const { data, refetch } = useQuery({
    queryKey: ["admin-trades", status],
    queryFn: () => listT({ data: status === "all" ? {} : { status: status as "awaiting_agreement"|"awaiting_seller_confirm"|"pending_payment"|"paid"|"released"|"cancelled"|"disputed" } }),
  });
  const trades = (data as { trades: Array<{ id: string; status: string; asset: string; crypto_amount: number; fiat_amount: number; fiat_currency: string; created_at: string; buyer_name: string | null; seller_name: string | null }> } | undefined)?.trades ?? [];
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Escrow trades</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="awaiting_agreement">Awaiting agreement</SelectItem>
            <SelectItem value="awaiting_seller_confirm">Awaiting seller confirm</SelectItem>
            <SelectItem value="pending_payment">Pending payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="text-left py-2">ID</th><th className="text-left">Buyer</th><th className="text-left">Seller</th><th className="text-left">Asset</th><th className="text-right">Crypto</th><th className="text-right">Fiat</th><th className="text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-border/40">
                <td className="py-2 font-mono"><Link to="/trade/$id" params={{ id: t.id }} className="underline">{t.id.slice(0,8)}</Link></td>
                <td>{t.buyer_name ?? "—"}</td>
                <td>{t.seller_name ?? "—"}</td>
                <td>{t.asset}</td>
                <td className="text-right font-mono">{Number(t.crypto_amount).toFixed(4)}</td>
                <td className="text-right font-mono">{Number(t.fiat_amount).toFixed(2)} {t.fiat_currency}</td>
                <td><Badge variant={t.status === "disputed" ? "destructive" : t.status === "released" ? "default" : "secondary"}>{t.status}</Badge></td>
                <td className="text-right space-x-1">
                  {["awaiting_agreement","awaiting_seller_confirm","pending_payment","paid","disputed"].includes(t.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={async () => { try { await release({ data: { trade_id: t.id } }); toast.success("Released"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Release</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { try { await cancel({ data: { trade_id: t.id } }); toast.success("Cancelled"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Cancel</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {trades.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No trades.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TelegramPanel() {
  const status = useServerFn(tgGetStatus);
  const setHook = useServerFn(tgSetWebhook);
  const delHook = useServerFn(tgDeleteWebhook);
  const sendTest = useServerFn(tgSendTest);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["tg-status"], queryFn: () => status() });
  const s = data as { hasKey: boolean; me: { username?: string; first_name?: string; id?: number } | null; webhook: { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number } | null } | undefined;
  const [url, setUrl] = useState("");
  const [chatId, setChatId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !url) {
      // Telegram cannot follow the id-preview auth redirect (302). Use the stable
      // project--<id>(-dev).lovable.app host instead.
      const host = window.location.host;
      const m = host.match(/^id-preview--([0-9a-f-]+)\.(.+)$/i);
      const base = m
        ? `${window.location.protocol}//project--${m[1]}-dev.${m[2]}`
        : window.location.origin;
      setUrl(`${base}/api/public/telegram/webhook`);
    }
  }, [url]);

  if (isLoading) return <div className="surface p-5 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Step 1 · Bot credentials</h2>
        <p className="mt-1 text-sm text-muted-foreground">The Telegram bot is connected via the Lovable Telegram connector. The bot token is stored as <code className="font-mono text-xs">TELEGRAM_API_KEY</code> and never exposed to the browser.</p>
        <div className="mt-3 grid gap-2 text-sm">
          <div>Status: {s?.hasKey ? <Badge>Connected</Badge> : <Badge variant="destructive">Missing API key</Badge>}</div>
          {s?.me && (
            <>
              <div>Bot: <span className="font-mono">@{s.me.username}</span> · {s.me.first_name}</div>
              <div>Bot ID: <span className="font-mono">{s.me.id}</span></div>
            </>
          )}
        </div>
        {!s?.hasKey && (
          <p className="mt-3 text-xs text-muted-foreground">Open Connectors → Telegram in the Lovable sidebar to (re)connect.</p>
        )}
      </div>

      <div className="surface p-5">
        <h2 className="font-semibold">Step 2 · Webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">Telegram will POST incoming messages to this URL. The shared secret is derived from your connector key.</p>
        <div className="mt-3 grid gap-2 text-sm">
          <label className="text-xs uppercase text-muted-foreground">Webhook URL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
          <div className="text-xs text-muted-foreground">Tip: for production use your stable URL (<code className="font-mono">https://project--&lt;id&gt;.lovable.app/api/public/telegram/webhook</code>).</div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={async () => { try { await setHook({ data: { url } }); toast.success("Webhook set"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Set webhook</Button>
            <Button size="sm" variant="outline" onClick={async () => { try { await delHook(); toast.success("Webhook deleted"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Delete webhook</Button>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>Refresh</Button>
          </div>
        </div>
        {s?.webhook && (
          <div className="mt-4 rounded-md border border-border/60 bg-secondary/30 p-3 text-xs">
            <div>Current URL: <span className="font-mono">{s.webhook.url || "(none)"}</span></div>
            <div>Pending updates: {s.webhook.pending_update_count ?? 0}</div>
            {s.webhook.last_error_message && (
              <div className="text-destructive">Last error: {s.webhook.last_error_message} ({s.webhook.last_error_date ? new Date(s.webhook.last_error_date * 1000).toLocaleString() : ""})</div>
            )}
          </div>
        )}
      </div>

      <div className="surface p-5">
        <h2 className="font-semibold">Step 3 · Send test message</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open Telegram, message your bot (tap <strong>Start</strong>) at least once, then paste your numeric chat ID here. If you don't know it, message <code className="font-mono">@userinfobot</code> to get your ID — or after messaging your bot, click <em>Webhook</em> → check pending updates, or use <code className="font-mono">/link</code> from your bot. Group/channel IDs start with <code className="font-mono">-100</code>.</p>
        <div className="mt-3 flex gap-2">
          <Input className="w-48 font-mono" placeholder="123456789" value={chatId} onChange={(e) => setChatId(e.target.value)} />
          <Button size="sm" onClick={async () => { try { await sendTest({ data: { chat_id: /^\d+$/.test(chatId) ? Number(chatId) : chatId } }); toast.success("Sent"); } catch (e) { toast.error((e as Error).message); } }} disabled={!chatId}>Send test</Button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const setFee = useServerFn(adminSetFee);
  const getAddrs = useServerFn(getCompanyEscrowAddresses);
  const setAddrs = useServerFn(adminSetCompanyEscrowAddresses);
  const [fee, setFeeVal] = useState("100");
  const [btc, setBtc] = useState("");
  const [ln, setLn] = useState("");
  useEffect(() => { getAddrs().then((r) => { setBtc(r.btc_address); setLn(r.lightning_address); }).catch(() => {}); }, [getAddrs]);
  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Company escrow payout addresses</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These are the treasury addresses shown to buyers when they fund an escrow. Leave a field empty to disable that rail.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">On-chain BTC address</Label>
            <Input value={btc} onChange={(e) => setBtc(e.target.value)} placeholder="bc1q… or 3… or 1…" className="font-mono text-xs" />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Lightning address / invoice</Label>
            <Input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="treasury@escrowdesk.com or lnbc…" className="font-mono text-xs" />
          </div>
        </div>
        <div className="mt-3"><Button onClick={async () => { try { await setAddrs({ data: { btc_address: btc.trim(), lightning_address: ln.trim() } }); toast.success("Saved"); } catch (e) { toast.error((e as Error).message); } }}>Save addresses</Button></div>
      </div>

      <div className="surface p-5">
        <h2 className="font-semibold">Platform fee (bps · 100 = 1%) — legacy override</h2>
        <p className="mt-1 text-xs text-muted-foreground">Tiered fees (set in <code className="font-mono">platform_settings.fee_tiers</code>) take precedence. This is a fallback if no tiers exist.</p>
        <div className="mt-2 flex gap-2">
          <Input className="w-32 font-mono" value={fee} onChange={(e) => setFeeVal(e.target.value)} />
          <Button onClick={async () => { try { await setFee({ data: { fee_bps: Number(fee) } }); toast.success("Saved"); } catch (e) { toast.error((e as Error).message); } }}>Save</Button>
        </div>
      </div>
    </div>
  );
}

type AdminUser = {
  user_id: string;
  display_name: string;
  telegram_username: string | null;
  telegram_user_id: number | null;
  is_banned: boolean;
  ban_reason: string | null;
  trades_completed: number;
  roles: string[];
};

const ALL_ROLES = ["admin","moderator","judge","finance","support"] as const;

function UsersPanel() {
  const listUsers = useServerFn(adminListUsers);
  const ban = useServerFn(adminBanUser);
  const unban = useServerFn(adminUnbanUser);
  const warn = useServerFn(adminWarnUser);
  const assign = useServerFn(adminAssignRole);
  const revoke = useServerFn(adminRevokeRole);
  const unlink = useServerFn(adminUnlinkTelegram);
  const [search, setSearch] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ data: search ? { search } : {} }),
  });
  const users = (data as { users: AdminUser[] } | undefined)?.users ?? [];

  // Live updates: refetch whenever a profile or role changes anywhere
  useEffect(() => {
    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);


  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Users</h2>
        <div className="flex gap-2">
          <Input placeholder="Search display name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {users.map((u) => (
          <div key={u.user_id} className="rounded-md border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{u.display_name} {u.is_banned && <Badge variant="destructive" className="ml-1">Banned</Badge>}</div>
                <div className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0,8)} · trades: {u.trades_completed} · TG: {u.telegram_username ? `@${u.telegram_username}` : "—"}</div>
                {u.ban_reason && <div className="text-xs text-destructive mt-1">Ban reason: {u.ban_reason}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.roles.length === 0 && <span className="text-xs text-muted-foreground">no roles</span>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {r}
                      <button className="ml-1 opacity-60 hover:opacity-100" onClick={async () => { try { await revoke({ data: { user_id: u.user_id, role: r as typeof ALL_ROLES[number] } }); toast.success("Revoked"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>×</button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select onValueChange={async (v) => { try { await assign({ data: { user_id: u.user_id, role: v as typeof ALL_ROLES[number] } }); toast.success(`Assigned ${v}`); refetch(); } catch (e) { toast.error((e as Error).message); } }}>
                  <SelectTrigger className="w-32 h-8"><SelectValue placeholder="+ Role" /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {u.is_banned
                  ? <Button size="sm" variant="outline" onClick={async () => { try { await unban({ data: { user_id: u.user_id } }); toast.success("Unbanned"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Unban</Button>
                  : <Button size="sm" variant="destructive" onClick={async () => { const reason = window.prompt("Ban reason?"); if (!reason) return; try { await ban({ data: { user_id: u.user_id, reason } }); toast.success("Banned"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Ban</Button>}
                <Button size="sm" variant="outline" onClick={async () => { const reason = window.prompt("Warning reason?"); if (!reason) return; const sev = window.prompt("Severity (minor|major|final)", "minor") as "minor"|"major"|"final"; try { await warn({ data: { user_id: u.user_id, reason, severity: sev || "minor" } }); toast.success("Warned"); } catch (e) { toast.error((e as Error).message); } }}>Warn</Button>
                {u.telegram_user_id && (
                  <Button size="sm" variant="ghost" onClick={async () => { if (!window.confirm("Unlink Telegram? User must re-run /link.")) return; try { await unlink({ data: { user_id: u.user_id } }); toast.success("Unlinked"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Unlink TG</Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="text-sm text-muted-foreground">No users.</div>}
      </div>
    </div>
  );
}

function WarningsPanel() {
  const listW = useServerFn(adminListWarnings);
  const { data } = useQuery({ queryKey: ["admin-warnings"], queryFn: () => listW() });
  const warnings = (data as { warnings: Array<{ id: string; user_name: string | null; issued_by_name: string | null; reason: string; severity: string; created_at: string }> } | undefined)?.warnings ?? [];
  return (
    <div className="surface p-5">
      <h2 className="font-semibold">Warnings log</h2>
      <div className="mt-3 space-y-2">
        {warnings.map((w) => (
          <div key={w.id} className="rounded-md border border-border/60 p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{w.user_name ?? "—"} · issued by {w.issued_by_name ?? "—"} · {new Date(w.created_at).toLocaleString()}</span>
              <Badge variant={w.severity === "final" ? "destructive" : w.severity === "major" ? "default" : "secondary"}>{w.severity}</Badge>
            </div>
            <p className="mt-1">{w.reason}</p>
          </div>
        ))}
        {warnings.length === 0 && <div className="text-sm text-muted-foreground">No warnings issued.</div>}
      </div>
    </div>
  );
}

// ============================== ADS PANEL ==============================

type AdRow = {
  id: string;
  title: string;
  media_type: "image" | "video" | "html" | "link";
  media_url: string | null;
  html_content: string | null;
  link_url: string | null;
  cta_label: string | null;
  placements: AdPlacement[];
  is_active: boolean;
  priority: number;
  impressions: number;
  clicks: number;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
};

const ALL_PLACEMENTS: { value: AdPlacement; label: string; group: "Site-wide" | "Landing extras" | "Page-specific" }[] = [
  { value: "top",                label: "Top — above every page",          group: "Site-wide" },
  { value: "center",             label: "Center — mid-content slot",       group: "Site-wide" },
  { value: "bottom",             label: "Bottom — above the footer",       group: "Site-wide" },
  { value: "footer",             label: "Footer — inside the footer",      group: "Site-wide" },
  { value: "footer_banner",      label: "Footer banner (above SiteFooter)",group: "Site-wide" },
  { value: "under_hero",         label: "Under hero banner",               group: "Landing extras" },
  { value: "between_threads",    label: "Between Latest Threads & Shoutbox", group: "Landing extras" },
  { value: "between_sections",   label: "Between Shoutbox & Tips",         group: "Landing extras" },
  { value: "inline_card",        label: "Inline card (bottom main column)",group: "Landing extras" },
  { value: "sidebar_top",        label: "Sidebar — top",                   group: "Landing extras" },
  { value: "sidebar_mid",        label: "Sidebar — middle",                group: "Landing extras" },
  { value: "sidebar_resources",  label: "Sidebar — replaces New Resources",group: "Landing extras" },
  { value: "sidebar_bottom",     label: "Sidebar — bottom",                group: "Landing extras" },
  { value: "floating_corner",    label: "Floating bottom-right corner",    group: "Landing extras" },
  { value: "marketplace_grid",   label: "Marketplace grid banner",         group: "Page-specific" },
  { value: "order_book_sidebar", label: "Order Book sidebar",              group: "Page-specific" },
  { value: "trades_escrow",      label: "Trades dashboard",                group: "Page-specific" },
];

function AdsPanel() {
  const list = useServerFn(adminListAds);
  const create = useServerFn(adminCreateAd);
  const update = useServerFn(adminUpdateAd);
  const del = useServerFn(adminDeleteAd);
  const healthFn = useServerFn(adminAdHealth);
  const { data, refetch } = useQuery({ queryKey: ["admin-ads"], queryFn: () => list() });
  const ads = ((data as { ads: AdRow[] } | undefined)?.ads ?? []);
  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ["admin-ad-health"],
    queryFn: () => healthFn(),
    refetchInterval: 60_000,
  });
  const health = ((healthData as { health: Record<string, { impressions: number; clicks: number; errors: number }> } | undefined)?.health ?? {});

  useEffect(() => {
    const ch = supabase.channel("admin-ads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ad_banners" }, () => { refetch(); refetchHealth(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch, refetchHealth]);

  const [form, setForm] = useState({
    title: "", media_type: "image" as "image"|"video"|"html"|"link",
    media_url: "", html_content: "", link_url: "", cta_label: "", priority: 0,
    placements: ["top"] as AdPlacement[], is_active: true,
    starts_at: "", ends_at: "",
    size_preset: "leaderboard_728x90" as string,
    width: 728 as number | null,
    height: 90 as number | null,
  });
  const [busy, setBusy] = useState(false);

  const togglePlacement = (p: AdPlacement) =>
    setForm((f) => ({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] }));

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    if (form.placements.length === 0) return toast.error("Pick at least one placement");
    if (form.media_type === "link" && !form.link_url.trim()) return toast.error("Click-through URL required for link/CTA ads");
    setBusy(true);
    try {
      await create({ data: {
        title: form.title.trim(),
        media_type: form.media_type,
        media_url: form.media_url || undefined,
        html_content: form.html_content || undefined,
        link_url: form.link_url || undefined,
        cta_label: form.cta_label || undefined,
        placements: form.placements,
        priority: form.priority,
        is_active: form.is_active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        size_preset: form.size_preset || null,
        width: form.width ?? null,
        height: form.height ?? null,
      } });
      toast.success("Ad created");
      setForm({ title: "", media_type: "image", media_url: "", html_content: "", link_url: "", cta_label: "", priority: 0, placements: ["top"], is_active: true, starts_at: "", ends_at: "", size_preset: "leaderboard_728x90", width: 728, height: 90 });
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Create ad banner</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Black Friday sale" />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Media type</Label>
            <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v as "image"|"video"|"html"|"link" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image (URL)</SelectItem>
                <SelectItem value="video">Video (URL)</SelectItem>
                <SelectItem value="html">HTML embed</SelectItem>
                <SelectItem value="link">Link / CTA only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.media_type === "image" || form.media_type === "video") && (
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">{form.media_type === "image" ? "Image" : "Video"} URL or upload</Label>
              <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://… or upload below" />
              <AdMediaUploader
                accept={form.media_type === "image" ? "image/*" : "video/*"}
                onUploaded={(url) => setForm((f) => ({ ...f, media_url: url }))}
              />
              {form.media_url && form.media_type === "image" && (
                <img src={form.media_url} alt="preview" className="mt-2 max-h-32 rounded-md border border-border/60" />
              )}
            </div>
          )}
          {form.media_type === "html" && (
            <div className="md:col-span-2">
              <Label className="text-xs uppercase text-muted-foreground">HTML content</Label>
              <Textarea rows={4} value={form.html_content} onChange={(e) => setForm({ ...form, html_content: e.target.value })} placeholder="<div>Your custom HTML…</div>" className="font-mono text-xs" />
            </div>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Click-through URL {form.media_type === "link" ? "(required)" : "(optional)"}
            </Label>
            <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase text-muted-foreground">CTA button label (optional, defaults to "Visit")</Label>
            <Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Shop now" maxLength={60} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase text-muted-foreground">Placements</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="mt-1.5 w-full justify-between font-normal">
                  <span className="truncate text-left text-sm">
                    {form.placements.length === 0
                      ? "Select where this ad shows…"
                      : form.placements.map((v) => ALL_PLACEMENTS.find((p) => p.value === v)?.label ?? v).join(" · ")}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px] p-2">
                {(["Site-wide", "Landing extras", "Page-specific"] as const).map((group) => (
                  <div key={group} className="mb-2 last:mb-0">
                    <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{group}</p>
                    <div className="space-y-0.5">
                      {ALL_PLACEMENTS.filter((p) => p.group === group).map((p) => {
                        const checked = form.placements.includes(p.value);
                        return (
                          <button
                            type="button" key={p.value}
                            onClick={() => togglePlacement(p.value)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${checked ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <span className="flex-1">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="md:col-span-2">
            <AdSizePicker
              presetKey={form.size_preset}
              width={form.width}
              height={form.height}
              onChange={(p) => setForm((f) => ({ ...f, size_preset: p.size_preset, width: p.width, height: p.height }))}
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Priority (0-100)</Label>
            <Input type="number" min="0" max="100" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm">Active</span>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Starts at (optional)</Label>
            <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Ends at (optional)</Label>
            <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
        </div>
        <Button onClick={submit} disabled={busy} className="mt-4">{busy ? "Creating…" : "Create banner"}</Button>

        <div className="mt-6 border-t border-border/60 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Live preview · how this ad will render on public pages</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {(["banner", "card", "sidebar"] as const).map((v) => (
              <div key={v}>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{v}</p>
                <AdDraftPreview form={form} variant={v} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <AdAnalyticsPanel />




      <div className="surface p-5">
        <h2 className="font-semibold">All banners ({ads.length})</h2>
        <div className="mt-3 space-y-3">
          {ads.map((a) => (
            <div key={a.id} className="rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Paused"}</Badge>
                    <Badge variant="outline" className="uppercase">{a.media_type}</Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">P{a.priority}</span>
                    <AdHealthBadge h={health[a.id]} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.placements.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                    {a.impressions} impressions · {a.clicks} clicks · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                  {(a.starts_at || a.ends_at) && (
                    <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                      Schedule: {a.starts_at ? new Date(a.starts_at).toLocaleString() : "—"} → {a.ends_at ? new Date(a.ends_at).toLocaleString() : "—"}
                    </div>
                  )}
                  {a.media_url && <div className="mt-1 truncate text-[11px] text-muted-foreground font-mono">{a.media_url}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Switch checked={a.is_active} onCheckedChange={async (v) => { try { await update({ data: { id: a.id, is_active: v } }); toast.success("Updated"); refetch(); } catch (e) { toast.error((e as Error).message); } }} />
                  <Button size="sm" variant="destructive" onClick={async () => { if (!window.confirm("Delete this banner?")) return; try { await del({ data: { id: a.id } }); toast.success("Deleted"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
          {ads.length === 0 && <p className="text-sm text-muted-foreground">No banners yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ============================== AD PREVIEW + HEALTH ==============================

type AdDraft = {
  title: string;
  media_type: "image" | "video" | "html" | "link";
  media_url: string;
  html_content: string;
  link_url: string;
  cta_label: string;
};

function AdDraftPreview({ form, variant }: { form: AdDraft; variant: "banner" | "card" | "sidebar" }) {
  const aspect = variant === "banner" ? "aspect-[6/1]" : variant === "card" ? "aspect-[16/9]" : "aspect-[4/5]";
  const sizeBase = variant === "banner" ? "rounded-md" : "rounded-lg";
  const ctaLabel = form.cta_label?.trim() || (form.link_url ? "Visit" : "Learn more");
  const hasMedia = form.media_type === "image" && form.media_url
    || form.media_type === "video" && form.media_url
    || form.media_type === "html" && form.html_content;
  const fallback = (
    <div className={`flex h-full w-full items-center justify-between gap-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-4 py-3 ${variant === "sidebar" ? "flex-col items-start text-left" : ""}`}>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sponsored</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground sm:text-base">{form.title || "Untitled banner"}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        {ctaLabel} <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </div>
  );
  return (
    <div className={`relative overflow-hidden border border-border/60 bg-secondary/20 ${sizeBase}`}>
      {!hasMedia || form.media_type === "link" ? (
        <div className={form.media_type === "link" ? "" : aspect}>{fallback}</div>
      ) : null}
      {form.media_type === "image" && form.media_url && (
        <img src={form.media_url} alt={form.title} className="block w-full object-cover" />
      )}
      {form.media_type === "video" && form.media_url && (
        <video src={form.media_url} className="block w-full" autoPlay muted loop playsInline preload="metadata" />
      )}
      {form.media_type === "html" && form.html_content && (
        <div className="ad-html prose-sm max-w-none p-3 text-sm [&_a]:text-primary [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: form.html_content }} />
      )}
    </div>
  );
}

function AdHealthBadge({ h }: { h?: { impressions: number; clicks: number; errors: number } }) {
  if (!h) {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
        <CircleDashed className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (h.errors > 0 && h.errors >= h.impressions) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3" /> Check URL · {h.errors} load errors
      </Badge>
    );
  }
  if (h.errors > 0) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3 text-amber-400" /> Partial · {h.errors} errors
      </Badge>
    );
  }
  if (h.impressions > 0) {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 text-[10px] text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
      <CircleDashed className="h-3 w-3" /> Pending
    </Badge>
  );
}



function AdAnalyticsPanel() {
  const fn = useServerFn(adminAdAnalytics);
  const [days, setDays] = useState(30);
  const { data } = useQuery({ queryKey: ["ad-analytics", days], queryFn: () => fn({ data: { days } }) });
  type Row = { ad_id: string; title: string; placements: string[]; impressions: number; clicks: number; ctr: number };
  type PRow = { placement: string; impressions: number; clicks: number; ctr: number };
  const ads = ((data as { ads: Row[] } | undefined)?.ads ?? []);
  const placements = ((data as { placements: PRow[] } | undefined)?.placements ?? []);
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ad performance (last {days} days)</h2>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">24 hours</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-mono uppercase text-muted-foreground">By ad</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left py-2">Title</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">CTR</th></tr>
              </thead>
              <tbody>
                {ads.map((r) => (
                  <tr key={r.ad_id} className="border-t border-border/40">
                    <td className="py-1.5 pr-2 truncate max-w-[180px]">{r.title}</td>
                    <td className="text-right font-mono">{Number(r.impressions).toLocaleString()}</td>
                    <td className="text-right font-mono">{Number(r.clicks).toLocaleString()}</td>
                    <td className="text-right font-mono">{Number(r.ctr).toFixed(2)}%</td>
                  </tr>
                ))}
                {ads.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-mono uppercase text-muted-foreground">By placement</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left py-2">Placement</th><th className="text-right">Impr.</th><th className="text-right">Clicks</th><th className="text-right">CTR</th></tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.placement} className="border-t border-border/40">
                    <td className="py-1.5 font-mono text-xs">{p.placement}</td>
                    <td className="text-right font-mono">{p.impressions.toLocaleString()}</td>
                    <td className="text-right font-mono">{p.clicks.toLocaleString()}</td>
                    <td className="text-right font-mono">{p.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
                {placements.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================ PRODUCTS PANEL ===========================

type ProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  image_url: string | null;
  stock: number;
  status: "active" | "inactive" | "sold_out";
  is_featured: boolean;
  seller_wallet_address: string | null;
  seller_wallet_asset: string | null;
  card_number?: string | null;
  bin_number?: string | null;
  card_user?: string | null;
  card_type?: string | null;
  card_brand?: string | null;
  card_bank?: string | null;
  card_country?: string | null;
  card_address?: string | null;
  cvv?: string | null;
  expire_date?: string | null;
  is_seeded?: boolean | null;
  created_at: string;
};


type ProductFormState = {
  name: string; description: string; price: string; currency: string;
  image_url: string; stock: string; seller_wallet_address: string; seller_wallet_asset: string;
  is_featured: boolean;
  card_number: string; bin_number: string; card_user: string; card_type: string;
  card_brand: string; card_bank: string; card_country: string; card_address: string;
  cvv: string; expire_date: string;
};

const emptyForm = (): ProductFormState => ({
  name: "", description: "", price: "", currency: "USD",
  image_url: "", stock: "-1", seller_wallet_address: "", seller_wallet_asset: "BTC",
  is_featured: false,
  card_number: "", bin_number: "", card_user: "", card_type: "",
  card_brand: "", card_bank: "", card_country: "", card_address: "",
  cvv: "", expire_date: "",
});

function ProductsPanel() {
  const list = useServerFn(adminListProducts);
  const update = useServerFn(adminUpdateProduct);
  const del = useServerFn(adminDeleteProduct);
  const { data, refetch } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const products = ((data as { products: ProductRow[] } | undefined)?.products ?? []);

  useEffect(() => {
    const ch = supabase.channel("admin-products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_products" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-semibold">Marketplace control center</h2>
          <p className="text-xs text-muted-foreground">Each category has its own dedicated create form and seed control. Listings appear in the marketplace in real time.</p>
        </div>
      </div>

      <Tabs defaultValue="BIN/CC">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-secondary/40 p-1">
          {MARKETPLACE_CATEGORIES.map((c) => {
            const count = products.filter((p) => p.category === c.value).length;
            return (
              <TabsTrigger key={c.value} value={c.value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {c.label}
                <span className="ml-2 rounded-full bg-background/30 px-1.5 py-0.5 font-mono text-[10px]">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {MARKETPLACE_CATEGORIES.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-4 space-y-4">
            <CategoryProductsSection
              category={c.value}
              label={c.label}
              blurb={c.blurb}
              products={products.filter((p) => p.category === c.value)}
              onChanged={refetch}
              update={update}
              del={del}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CategoryProductsSection({
  category, label, blurb, products, onChanged, update, del,
}: {
  category: MarketplaceCategory;
  label: string;
  blurb: string;
  products: ProductRow[];
  onChanged: () => void;
  update: ReturnType<typeof useServerFn<typeof adminUpdateProduct>>;
  del: ReturnType<typeof useServerFn<typeof adminDeleteProduct>>;
}) {
  const create = useServerFn(adminCreateProduct);
  const seed = useServerFn(adminSeedSampleProducts);
  const binLookup = useServerFn(lookupBinMetadata);
  const [form, setForm] = useState<ProductFormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lookupNote, setLookupNote] = useState("Enter a full card number to autofill BIN metadata");

  const submit = async () => {
    if (!form.name.trim() || !form.description.trim()) return toast.error("Name and description required");
    const price = Number(form.price);
    if (!price || price <= 0) return toast.error("Valid price required");
    if (category === "BIN/CC" && !form.card_number.trim()) return toast.error("Card number is required for BIN listings");
    setBusy(true);
    try {
      await create({ data: {
        name: form.name.trim(),
        description: form.description.trim(),
        category,
        price,
        currency: form.currency.toUpperCase(),
        image_url: form.image_url || undefined,
        stock: Number(form.stock) || -1,
        seller_wallet_address: form.seller_wallet_address || undefined,
        seller_wallet_asset: "BTC",
        is_featured: form.is_featured,
        card_number: category === "BIN/CC" ? form.card_number || undefined : undefined,
        bin_number: category === "BIN/CC" ? form.bin_number || undefined : undefined,
        card_user: category === "BIN/CC" ? form.card_user || undefined : undefined,
        card_type: category === "BIN/CC" ? form.card_type || undefined : undefined,
        card_brand: category === "BIN/CC" ? form.card_brand || undefined : undefined,
        card_bank: category === "BIN/CC" ? form.card_bank || undefined : undefined,
        card_country: category === "BIN/CC" ? form.card_country || undefined : undefined,
        card_address: category === "BIN/CC" ? form.card_address || undefined : undefined,
        cvv: category === "BIN/CC" ? form.cvv || undefined : undefined,
        expire_date: category === "BIN/CC" ? form.expire_date || undefined : undefined,
      } });
      toast.success(`${label} product added`);
      setForm(emptyForm());
      setLookupNote("Enter a full card number to autofill BIN metadata");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const runSeed = async () => {
    if (!window.confirm(`Insert 10 demo products into the ${label}?`)) return;
    setSeeding(true);
    try {
      const r = await seed({ data: { perCategory: 10, category } });
      toast.success(`Seeded ${(r as { inserted: number }).inserted} ${label} products`);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSeeding(false); }
  };

  const commonFields = (
    <>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase text-muted-foreground">Product name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`e.g. Premium ${label} pack`} />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase text-muted-foreground">About / description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown on the product card and details page" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Image URL (blank = auto placeholder)</Label>
        <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Price</Label>
        <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Currency</Label>
        <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={8} />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Stock (-1 = unlimited)</Label>
        <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Payout asset</Label>
        <div className="flex h-10 items-center rounded-md border border-input bg-secondary/30 px-3 text-sm font-medium">BTC</div>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase text-muted-foreground">Payout wallet address</Label>
        <Input value={form.seller_wallet_address} onChange={(e) => setForm({ ...form, seller_wallet_address: e.target.value })} placeholder="Where the escrow should be funded" className="font-mono text-xs" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
        <span className="text-sm">Featured product</span>
      </div>
    </>
  );

  const binFields = (
    <>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase text-muted-foreground">Card number</Label>
        <Input
          value={form.card_number}
          onChange={(e) => setForm({ ...form, card_number: e.target.value })}
          onBlur={async () => {
            const digits = form.card_number.replace(/\D/g, "");
            if (digits.length >= 16) {
              setLookupNote("Looking up BIN metadata…");
              try {
                const r = await binLookup({ data: { card_number: form.card_number } });
                if (r.metadata) {
                  setForm((prev) => ({
                    ...prev,
                    bin_number: r.metadata?.bin_number ?? prev.bin_number,
                    card_brand: r.metadata?.card_brand ?? prev.card_brand,
                    card_type: r.metadata?.card_type ?? prev.card_type,
                    card_bank: r.metadata?.card_bank ?? prev.card_bank,
                    card_country: r.metadata?.card_country ?? prev.card_country,
                    card_address: r.metadata?.card_address ?? prev.card_address,
                  }));
                  setLookupNote("BIN metadata filled from database.");
                } else {
                  setLookupNote("No BIN metadata found. Complete fields manually.");
                }
              } catch {
                setLookupNote("BIN lookup failed. Please enter metadata manually.");
              }
            }
          }}
          placeholder="1234 5678 9012 3456"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">{lookupNote}</p>
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">BIN / first six digits</Label>
        <Input value={form.bin_number} onChange={(e) => setForm({ ...form, bin_number: e.target.value })} placeholder="412345" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Cardholder</Label>
        <Input value={form.card_user} onChange={(e) => setForm({ ...form, card_user: e.target.value })} placeholder="Cardholder name" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Card brand</Label>
        <Input value={form.card_brand} onChange={(e) => setForm({ ...form, card_brand: e.target.value })} placeholder="Visa, Mastercard, Amex" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Card type</Label>
        <Input value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value })} placeholder="Debit / Credit" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Issuing bank</Label>
        <Input value={form.card_bank} onChange={(e) => setForm({ ...form, card_bank: e.target.value })} placeholder="Bank name" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Country</Label>
        <Input value={form.card_country} onChange={(e) => setForm({ ...form, card_country: e.target.value })} placeholder="US, UK, NG…" />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase text-muted-foreground">Card address</Label>
        <Input value={form.card_address} onChange={(e) => setForm({ ...form, card_address: e.target.value })} placeholder="City, state or mailing address" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">CVV / CVC</Label>
        <Input value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value })} placeholder="123" maxLength={4} type="password" />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Expiry date (MM/YY)</Label>
        <Input value={form.expire_date} onChange={(e) => setForm({ ...form, expire_date: e.target.value })} placeholder="12/25" maxLength={5} />
      </div>
    </>
  );

  return (
    <>
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
        <Button size="sm" variant="outline" onClick={runSeed} disabled={seeding}>
          {seeding ? "Seeding…" : `🌱 Seed 10 demo ${label} products`}
        </Button>
      </div>

      <div className="surface p-5">
        <h3 className="font-semibold">Create a new {label} product</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {category === "BIN/CC" && binFields}
          {commonFields}
        </div>
        <Button onClick={submit} disabled={busy} className="mt-4">{busy ? "Adding…" : `Add ${label} product`}</Button>
      </div>

      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{label} listings ({products.length})</h3>
        </div>
        <div className="mt-3 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-md object-cover" loading="lazy" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.is_featured && <Badge>Featured</Badge>}
                      {p.is_seeded && <Badge variant="outline" className="border-amber-500/60 text-amber-600 dark:text-amber-400">Seeded demo</Badge>}
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground">{p.price} {p.currency} · Stock: {p.stock === -1 ? "∞" : p.stock}</div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{p.description}</p>
                    {p.category === "BIN/CC" && (
                      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-3">
                        {p.card_number && <div><span className="opacity-70">PAN:</span> {p.card_number}</div>}
                        {p.bin_number && <div><span className="opacity-70">BIN:</span> {p.bin_number}</div>}
                        {p.cvv && <div><span className="opacity-70">CVV:</span> {p.cvv}</div>}
                        {p.expire_date && <div><span className="opacity-70">Exp:</span> {p.expire_date}</div>}
                        {p.card_brand && <div><span className="opacity-70">Brand:</span> {p.card_brand}</div>}
                        {p.card_type && <div><span className="opacity-70">Type:</span> {p.card_type}</div>}
                        {p.card_bank && <div><span className="opacity-70">Bank:</span> {p.card_bank}</div>}
                        {p.card_country && <div><span className="opacity-70">Country:</span> {p.card_country}</div>}
                        {p.card_user && <div className="col-span-2 sm:col-span-3"><span className="opacity-70">Holder:</span> {p.card_user}</div>}
                        {p.card_address && <div className="col-span-2 sm:col-span-3"><span className="opacity-70">Address:</span> {p.card_address}</div>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={p.category} onValueChange={async (v) => { try { await update({ data: { id: p.id, category: v } }); toast.success("Moved"); onChanged(); } catch (e) { toast.error((e as Error).message); } }}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={p.status} onValueChange={async (v) => { try { await update({ data: { id: p.id, status: v as "active"|"inactive"|"sold_out" } }); toast.success("Updated"); onChanged(); } catch (e) { toast.error((e as Error).message); } }}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="sold_out">Sold out</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={async () => { try { await update({ data: { id: p.id, is_featured: !p.is_featured } }); toast.success("Updated"); onChanged(); } catch (e) { toast.error((e as Error).message); } }}>{p.is_featured ? "Unfeature" : "Feature"}</Button>
                  <EditProductDialog product={p} update={update} onSaved={onChanged} />
                  <Button size="sm" variant="destructive" onClick={async () => { if (!window.confirm("Delete this product?")) return; try { await del({ data: { id: p.id } }); toast.success("Deleted"); onChanged(); } catch (e) { toast.error((e as Error).message); } }}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-muted-foreground">No {label} products yet. Use the form above or the seed button.</p>}
        </div>
      </div>
    </>
  );
}

function EditProductDialog({ product, update, onSaved }: {
  product: ProductRow;
  update: ReturnType<typeof useServerFn<typeof adminUpdateProduct>>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => ({
    name: product.name,
    description: product.description,
    category: product.category,
    price: String(product.price ?? ""),
    currency: product.currency || "USD",
    image_url: product.image_url ?? "",
    stock: String(product.stock ?? -1),
    seller_wallet_address: product.seller_wallet_address ?? "",
    is_featured: !!product.is_featured,
    status: product.status,
    card_number: product.card_number ?? "",
    bin_number: product.bin_number ?? "",
    card_user: product.card_user ?? "",
    card_type: product.card_type ?? "",
    card_brand: product.card_brand ?? "",
    card_bank: product.card_bank ?? "",
    card_country: product.card_country ?? "",
    card_address: product.card_address ?? "",
    cvv: product.cvv ?? "",
    expire_date: product.expire_date ?? "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const price = Number(f.price);
    if (!f.name.trim() || !f.description.trim()) return toast.error("Name and description required");
    if (!price || price <= 0) return toast.error("Valid price required");
    setBusy(true);
    try {
      const isBin = f.category === "BIN/CC";
      await update({ data: {
        id: product.id,
        name: f.name.trim(),
        description: f.description.trim(),
        category: f.category,
        price,
        currency: f.currency.toUpperCase(),
        image_url: f.image_url ? f.image_url : null,
        stock: Number(f.stock) || -1,
        seller_wallet_address: f.seller_wallet_address ? f.seller_wallet_address : null,
        is_featured: f.is_featured,
        status: f.status,
        card_number: isBin ? (f.card_number || null) : null,
        bin_number: isBin ? (f.bin_number || null) : null,
        card_user: isBin ? (f.card_user || null) : null,
        card_type: isBin ? (f.card_type || null) : null,
        card_brand: isBin ? (f.card_brand || null) : null,
        card_bank: isBin ? (f.card_bank || null) : null,
        card_country: isBin ? (f.card_country || null) : null,
        card_address: isBin ? (f.card_address || null) : null,
        cvv: isBin ? (f.cvv || null) : null,
        expire_date: isBin ? (f.expire_date || null) : null,
      } });
      toast.success("Product updated");
      setOpen(false);
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div>
              <Label>Category</Label>
              <Select value={f.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MARKETPLACE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v as ProductRow["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="sold_out">Sold out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Price</Label><Input type="number" step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
            <div><Label>Currency</Label><Input value={f.currency} onChange={(e) => set("currency", e.target.value)} /></div>
            <div><Label>Stock (-1 = ∞)</Label><Input type="number" value={f.stock} onChange={(e) => set("stock", e.target.value)} /></div>
            <div className="flex items-end gap-2"><Switch checked={f.is_featured} onCheckedChange={(v) => set("is_featured", v)} /><span className="text-sm">Featured</span></div>
            <div className="sm:col-span-2"><Label>Image URL</Label><Input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Seller payout (BTC) address</Label><Input value={f.seller_wallet_address} onChange={(e) => set("seller_wallet_address", e.target.value)} /></div>

            {f.category === "BIN/CC" && (
              <>
                <div className="sm:col-span-2 mt-2 border-t border-border/60 pt-2 text-xs font-medium text-muted-foreground">Card details</div>
                <div><Label>Card number (PAN)</Label><Input value={f.card_number} onChange={(e) => set("card_number", e.target.value)} /></div>
                <div><Label>BIN (6 digits)</Label><Input value={f.bin_number} onChange={(e) => set("bin_number", e.target.value)} /></div>
                <div><Label>CVV</Label><Input value={f.cvv} onChange={(e) => set("cvv", e.target.value)} /></div>
                <div><Label>Expire (MM/YY)</Label><Input value={f.expire_date} onChange={(e) => set("expire_date", e.target.value)} /></div>
                <div><Label>Holder</Label><Input value={f.card_user} onChange={(e) => set("card_user", e.target.value)} /></div>
                <div><Label>Brand</Label><Input value={f.card_brand} onChange={(e) => set("card_brand", e.target.value)} /></div>
                <div><Label>Type</Label><Input value={f.card_type} onChange={(e) => set("card_type", e.target.value)} /></div>
                <div><Label>Bank</Label><Input value={f.card_bank} onChange={(e) => set("card_bank", e.target.value)} /></div>
                <div><Label>Country</Label><Input value={f.card_country} onChange={(e) => set("card_country", e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Billing address</Label><Input value={f.card_address} onChange={(e) => set("card_address", e.target.value)} /></div>
              </>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ─────────────────────── Threads (user-posted listings) ─────────────────────── */
function ThreadsPanel() {
  const list = useServerFn(adminListThreads);
  const setStatus = useServerFn(adminSetThreadStatus);
  const del = useServerFn(adminDeleteThread);
  const { data, refetch, isFetching } = useQuery({ queryKey: ["admin-threads"], queryFn: () => list() });
  const threads = data?.threads ?? [];
  const [cat, setCat] = useState<string>("All");
  const cats = ["All", ...THREAD_SECTIONS.map((s) => s.label)];
  const filtered = threads.filter((t) => {
    if (cat === "All") return true;
    return sectionOf(t.category) === cat;
  });
  return (
    <div className="surface p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Community Threads</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">{filtered.length} of {threads.length}</Badge>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Threads are user-posted selling/seeking offers from the order book. Moderate categories, deactivate, mark sold, or remove.</p>
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${cat === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-2 py-1.5">Thread</th><th className="px-2 py-1.5">Kind</th><th className="px-2 py-1.5">Category</th><th className="px-2 py-1.5">Amount</th><th className="px-2 py-1.5">Status</th><th className="px-2 py-1.5">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-background/40">
                <td className="px-2 py-2 max-w-[280px] truncate font-medium">{t.name}</td>
                <td className="px-2 py-2 uppercase font-mono text-[10px]">{t.kind}</td>
                <td className="px-2 py-2"><Badge variant="outline" className="text-[10px]">{t.category}</Badge></td>
                <td className="px-2 py-2 font-mono tabular-nums">{t.amount ? `${Number(t.amount).toFixed(2)} ${t.currency ?? ""}` : "—"}</td>
                <td className="px-2 py-2"><Badge variant={t.status === "active" ? "default" : "secondary"} className="text-[10px]">{t.status}</Badge></td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {t.status !== "active" && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={async () => { await setStatus({ data: { id: t.id, status: "active" } }); toast.success("Activated"); refetch(); }}>Activate</Button>
                    )}
                    {t.status !== "inactive" && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={async () => { await setStatus({ data: { id: t.id, status: "inactive" } }); toast.success("Deactivated"); refetch(); }}>Deactivate</Button>
                    )}
                    {t.status !== "sold" && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={async () => { await setStatus({ data: { id: t.id, status: "sold" } }); toast.success("Marked sold"); refetch(); }}>Mark sold</Button>
                    )}
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px]" onClick={async () => { if (!confirm("Delete this thread?")) return; await del({ data: { id: t.id } }); toast.success("Deleted"); refetch(); }}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No threads match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────── Ad media uploader (uploads to `ads` storage bucket) ─────────────────── */
function AdMediaUploader({ accept, onUploaded }: { accept: string; onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ads").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("ads").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Uploaded");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-2">
      <Input type="file" accept={accept} disabled={busy} onChange={(e) => onPick(e.target.files?.[0] ?? null)} className="h-8 file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:text-primary-foreground" />
      {busy && <span className="text-xs text-muted-foreground">Uploading…</span>}
    </div>
  );
}

/* ─────────────────── Shoutbox moderation + BTC settings ─────────────────── */
function ShoutboxPanel() {
  const listFn = useServerFn(adminListShouts);
  const reviewFn = useServerFn(adminReviewShout);
  const pinFn = useServerFn(adminTogglePin);
  const hideFn = useServerFn(adminToggleHide);
  const cfgFn = useServerFn(getShoutboxConfig);
  const setCfg = useServerFn(adminSetShoutboxBtc);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data, refetch } = useQuery({ queryKey: ["admin-shouts", status], queryFn: () => listFn({ data: { status } }) });
  const { data: cfg, refetch: refetchCfg } = useQuery({ queryKey: ["admin-shoutbox-cfg"], queryFn: () => cfgFn() });
  const rows = ((data as { messages: ShoutMsg[] } | undefined)?.messages ?? []);

  const [btc, setBtc] = useState("");
  const [fee, setFee] = useState("5");
  useEffect(() => {
    if (cfg) { setBtc(cfg.btc_address || ""); setFee(String(cfg.fee_usd ?? 5)); }
  }, [cfg]);

  useEffect(() => {
    const ch = supabase.channel("admin-shouts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shoutbox_messages" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const save = async () => {
    try {
      await setCfg({ data: { btc_address: btc.trim(), fee_usd: Number(fee) || 5 } });
      toast.success("Saved"); refetchCfg();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Shoutbox payments</h2>
        <p className="text-xs text-muted-foreground">Users pay this fee to publish a shoutbox. Wallet payments auto-approve; BTC payments wait for your manual review.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Admin company BTC address</Label>
            <Input value={btc} onChange={(e) => setBtc(e.target.value)} placeholder="bc1q…" className="font-mono text-xs" />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Fee (USD)</Label>
            <Input type="number" min="0.01" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="flex items-end"><Button onClick={save}>Save</Button></div>
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Shoutbox posts</h2>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No shouts in this view.</p>}
          {rows.map((m) => (
            <div key={m.id} className="rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{m.display_name}</span>
                  <Badge variant={m.status === "approved" ? "default" : m.status === "rejected" ? "destructive" : "secondary"}>{m.status}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">{m.payment_method ?? "—"}</Badge>
                  {m.paid_amount_usd != null && <span className="font-mono text-[11px]">${Number(m.paid_amount_usd).toFixed(2)}</span>}
                  {m.is_pinned && <Badge className="bg-amber-500 text-white">📌 Pinned</Badge>}
                  {m.is_hidden && <Badge variant="destructive">Hidden</Badge>}
                  {(m.report_count ?? 0) > 0 && <Badge variant="destructive">⚠ {m.report_count} reports</Badge>}
                </div>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{m.body}</p>
              {m.payment_txid && <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">txid: {m.payment_txid}</div>}
              <div className="mt-2 flex flex-wrap gap-2">
                {m.status === "pending" && (
                  <>
                    <Button size="sm" onClick={async () => { try { await reviewFn({ data: { id: m.id, action: "approve" } }); toast.success("Approved"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={async () => { try { await reviewFn({ data: { id: m.id, action: "reject" } }); toast.success("Rejected"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Reject</Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={async () => { try { await pinFn({ data: { id: m.id, pinned: !m.is_pinned } }); toast.success(m.is_pinned ? "Unpinned" : "Pinned"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>
                  {m.is_pinned ? "Unpin" : "Pin"}
                </Button>
                <Button size="sm" variant={m.is_hidden ? "default" : "outline"} onClick={async () => { try { await hideFn({ data: { id: m.id, hidden: !m.is_hidden } }); toast.success(m.is_hidden ? "Unhidden" : "Hidden"); refetch(); } catch (e) { toast.error((e as Error).message); } }}>
                  {m.is_hidden ? "Unhide" : "Hide"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Support Panel ---------------- */
function SupportPanel() {
  const list = useServerFn(listSupportTickets);
  const respond = useServerFn(respondToSupportTicket);
  const { data, refetch } = useQuery({ queryKey: ["support-tickets"], queryFn: () => list() });
  const tickets = (data?.tickets ?? []) as Array<{ id: string; email: string; subject: string; message: string; status: string; admin_response: string | null; responded_at: string | null; created_at: string }>;
  const [replies, setReplies] = useState<Record<string, string>>({});
  return (
    <div className="surface p-5">
      <h2 className="font-semibold">Support tickets</h2>
      <p className="text-xs text-muted-foreground">From the support form on Settings & Escrow pages. Responses notify the user in-app.</p>
      <div className="mt-4 space-y-3">
        {tickets.length === 0 && <p className="text-xs text-muted-foreground">No tickets yet.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="rounded-md border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t.email} · {new Date(t.created_at).toLocaleString()}</span>
              <Badge variant={t.status === "open" ? "destructive" : "secondary"}>{t.status}</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">{t.subject}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs">{t.message}</p>
            {t.admin_response && (
              <div className="mt-2 rounded border border-primary/30 bg-primary/5 p-2 text-xs">
                <p className="text-[10px] uppercase tracking-wider text-primary">Reply · {t.responded_at && new Date(t.responded_at).toLocaleString()}</p>
                <p className="whitespace-pre-wrap">{t.admin_response}</p>
              </div>
            )}
            {t.status !== "closed" && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Textarea
                  className="flex-1"
                  rows={2}
                  placeholder="Write a reply (sent as in-app notification)…"
                  value={replies[t.id] ?? ""}
                  onChange={(e) => setReplies((r) => ({ ...r, [t.id]: e.target.value }))}
                />
                <div className="flex sm:flex-col gap-2">
                  <Button size="sm" onClick={async () => {
                    const v = (replies[t.id] ?? "").trim(); if (!v) return;
                    try { await respond({ data: { id: t.id, response: v, status: "responded" } }); toast.success("Reply sent"); setReplies((r) => ({ ...r, [t.id]: "" })); refetch(); }
                    catch (e) { toast.error((e as Error).message); }
                  }}>Reply</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await respond({ data: { id: t.id, response: replies[t.id] || "Closed by admin", status: "closed" } }); toast.success("Closed"); refetch(); }
                    catch (e) { toast.error((e as Error).message); }
                  }}>Close</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Announcements Panel ---------------- */
function AnnouncementsPanel() {
  const list = useServerFn(adminListAnnouncements);
  const create = useServerFn(adminCreateAnnouncement);
  const toggle = useServerFn(adminToggleAnnouncement);
  const remove = useServerFn(adminDeleteAnnouncement);
  const { data, refetch } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => list() });
  const items = (data?.announcements ?? []) as Array<{ id: string; title: string; body: string; link: string | null; is_active: boolean; published_at: string }>;
  const [form, setForm] = useState({ title: "", body: "", link: "", broadcast_inapp: true, broadcast_telegram: true });
  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Create announcement</h2>
        <p className="text-xs text-muted-foreground">Shows as a banner on landing & home. Optionally fans out as in-app notifications and Telegram messages to every user.</p>
        <div className="mt-3 grid gap-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Body" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Input placeholder="Optional link (https://…)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2"><Checkbox checked={form.broadcast_inapp} onCheckedChange={(v) => setForm({ ...form, broadcast_inapp: !!v })} /> Send as in-app notification</label>
            <label className="flex items-center gap-2"><Checkbox checked={form.broadcast_telegram} onCheckedChange={(v) => setForm({ ...form, broadcast_telegram: !!v })} /> Send to Telegram</label>
          </div>
          <Button onClick={async () => {
            try { const r = await create({ data: form }); toast.success(`Published — ${r.notified} notified`); setForm({ title: "", body: "", link: "", broadcast_inapp: true, broadcast_telegram: true }); refetch(); }
            catch (e) { toast.error((e as Error).message); }
          }}>Publish</Button>
        </div>
      </div>

      <div className="surface p-5">
        <h2 className="font-semibold">Past announcements</h2>
        <div className="mt-3 space-y-2">
          {items.map((a) => (
            <div key={a.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(a.published_at).toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={a.is_active} onCheckedChange={async (v) => { try { await toggle({ data: { id: a.id, is_active: v } }); refetch(); } catch (e) { toast.error((e as Error).message); } }} />
                  <Button size="sm" variant="ghost" onClick={async () => { if (!confirm("Delete?")) return; try { await remove({ data: { id: a.id } }); refetch(); } catch (e) { toast.error((e as Error).message); } }}>Delete</Button>
                </div>
              </div>
              <p className="mt-1 text-sm font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Broadcast (DM) Panel ---------------- */
function BroadcastPanel() {
  const send = useServerFn(adminSendUserMessage);
  const listUsers = useServerFn(adminListUsersLite);
  const { data: udata } = useQuery({ queryKey: ["admin-users-lite"], queryFn: () => listUsers() });
  const users = (udata?.users ?? []) as Array<{ user_id: string; display_name: string | null; telegram_username: string | null }>;
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ title: "", body: "", link: "", also_telegram: false });
  const filtered = users.filter((u) => !filter || (u.display_name ?? "").toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="surface p-5 space-y-3">
      <h2 className="font-semibold">Direct message users</h2>
      <p className="text-xs text-muted-foreground">Delivered as in-app notification. Optionally also via Telegram to linked accounts.</p>
      <div className="grid gap-3">
        <Select value={target} onValueChange={(v) => setTarget(v as "all" | "selected")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="selected">Pick specific users</SelectItem>
          </SelectContent>
        </Select>
        {target === "selected" && (
          <div className="rounded-md border border-border/60 p-3">
            <Input placeholder="Filter by name…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2" />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {filtered.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={picked.includes(u.user_id)}
                    onCheckedChange={(v) => setPicked((p) => v ? [...p, u.user_id] : p.filter((x) => x !== u.user_id))}
                  />
                  <span>{u.display_name || u.user_id.slice(0, 8)}</span>
                  {u.telegram_username && <span className="text-muted-foreground">· @{u.telegram_username}</span>}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{picked.length} selected</p>
          </div>
        )}
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea placeholder="Message" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <Input placeholder="Optional link (https://…)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={form.also_telegram} onCheckedChange={(v) => setForm({ ...form, also_telegram: !!v })} /> Also send via Telegram (email gateway not configured yet)</label>
        <Button onClick={async () => {
          try {
            const r = await send({ data: { ...form, target, user_ids: picked } });
            toast.success(`Sent to ${r.recipients} user(s)`);
            setForm({ title: "", body: "", link: "", also_telegram: false }); setPicked([]);
          } catch (e) { toast.error((e as Error).message); }
        }}>Send</Button>
      </div>
    </div>
  );
}

/* ---------------- Newsletter Panel ---------------- */
function NewsletterPanel() {
  const list = useServerFn(listNewsletterSubscribers);
  const broadcast = useServerFn(broadcastNewsletter);
  const { data, refetch } = useQuery({ queryKey: ["newsletter-subs"], queryFn: () => list() });
  const subs = (data?.subscribers ?? []) as Array<{ id: string; email: string; source: string | null; subscribed_at: string; unsubscribed_at: string | null }>;
  const [form, setForm] = useState({ title: "", body: "", link: "" });
  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <h2 className="font-semibold">Broadcast newsletter</h2>
        <p className="text-xs text-muted-foreground">Goes to every signed-in user as in-app notification (email gateway not yet configured).</p>
        <div className="mt-3 grid gap-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Body" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Input placeholder="Optional link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <Button onClick={async () => {
            try { const r = await broadcast({ data: form }); toast.success(`Sent to ${r.recipients} users`); setForm({ title: "", body: "", link: "" }); refetch(); }
            catch (e) { toast.error((e as Error).message); }
          }}>Send broadcast</Button>
        </div>
      </div>
      <div className="surface p-5">
        <h2 className="font-semibold">Subscribers ({subs.length})</h2>
        <div className="mt-3 max-h-96 overflow-y-auto space-y-1">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-xs">
              <span className="font-mono">{s.email}</span>
              <span className="text-muted-foreground">{s.source} · {new Date(s.subscribed_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
