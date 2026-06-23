import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  User as UserIcon, Shield, Bell, Key, Smartphone, Wallet, Eye, Activity,
  Lock, Camera, Loader2, Copy, Trash2, Plus, Send, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateTelegramLink } from "@/lib/escrow.functions";
import {
  getMySettings, updateMySettings, updateWithdrawalPolicy,
  createApiToken, revokeApiToken, revokeTrustedDevice, changePassword,
} from "@/lib/settings.functions";
import { NotificationSettings } from "@/components/NotificationSettings";

export const Route = createFileRoute("/settings")({
  component: () => (<AuthGate><Settings /></AuthGate>),
});

const SATS = 100_000_000;
const fmtBtc = (s: number) => (s / SATS).toFixed(4);
const fmtAgo = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`; return `${Math.floor(m / 1440)}d ago`;
};

function Settings() {
  const fetchAll = useServerFn(getMySettings);
  const { data, isLoading } = useQuery({ queryKey: ["my-settings"], queryFn: () => fetchAll() });

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, security, wallet controls and platform preferences — all in one place.
        </p>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 bg-secondary/30 p-1">
          <TabsTrigger value="profile"><UserIcon className="mr-1.5 h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1.5 h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="wallet"><Wallet className="mr-1.5 h-3.5 w-3.5" /> Wallet</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="privacy"><Eye className="mr-1.5 h-3.5 w-3.5" /> Privacy</TabsTrigger>
          <TabsTrigger value="tokens"><Key className="mr-1.5 h-3.5 w-3.5" /> API tokens</TabsTrigger>
          <TabsTrigger value="devices"><Smartphone className="mr-1.5 h-3.5 w-3.5" /> Devices</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-1.5 h-3.5 w-3.5" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"        className="mt-6"><ProfileTab data={data} /></TabsContent>
        <TabsContent value="security"       className="mt-6"><SecurityTab email={data.email} /></TabsContent>
        <TabsContent value="wallet"         className="mt-6"><WalletTab data={data} /></TabsContent>
        <TabsContent value="notifications"  className="mt-6"><div className="surface p-5"><NotificationSettings /></div></TabsContent>
        <TabsContent value="privacy"        className="mt-6"><PrivacyTab data={data} /></TabsContent>
        <TabsContent value="tokens"         className="mt-6"><TokensTab tokens={data.tokens} /></TabsContent>
        <TabsContent value="devices"        className="mt-6"><DevicesTab devices={data.devices} /></TabsContent>
        <TabsContent value="activity"       className="mt-6"><ActivityTab events={data.events} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Profile ---------------- */

type SettingsData = Awaited<ReturnType<typeof getMySettings>>;

function ProfileTab({ data }: { data: SettingsData }) {
  const { user } = useAuth();
  const save = useServerFn(updateMySettings);
  const link = useServerFn(generateTelegramLink);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tg, setTg] = useState<{ code: string; deep_link: string | null } | null>(null);

  const [form, setForm] = useState({
    display_name: data.profile?.display_name ?? "",
    bio: data.profile?.bio ?? "",
    timezone: data.profile?.timezone ?? "UTC",
    locale: data.profile?.locale ?? "en",
    preferred_currency: data.profile?.preferred_currency ?? "USD",
  });

  const mut = useMutation({
    mutationFn: (patch: Partial<typeof form>) => save({ data: patch }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-settings"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("Max 4MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await save({ data: { avatar_url: pub.publicUrl } });
      qc.invalidateQueries({ queryKey: ["my-settings"] }); qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Avatar updated");
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <SectionHead title="Public profile" subtitle="How other traders see you across the marketplace." />
        <div className="mt-4 flex flex-col gap-5 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="group relative h-24 w-24 overflow-hidden rounded-full border border-border/60 bg-secondary/30">
              {data.profile?.avatar_url
                ? <img src={data.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                : <div className="grid h-full w-full place-items-center text-muted-foreground"><UserIcon className="h-8 w-8" /></div>}
              <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            <span className="text-[10px] text-muted-foreground">PNG, JPG or WEBP · 4MB max</span>
          </div>
          <div className="flex-1 space-y-3">
            <Field label="Display name">
              <Input value={form.display_name} maxLength={80} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </Field>
            <Field label="Bio">
              <Textarea rows={3} maxLength={500} value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell other traders about yourself…" />
            </Field>
            <div className="flex gap-2">
              <Button onClick={() => mut.mutate({ display_name: form.display_name, bio: form.bio })} disabled={mut.isPending}>
                {mut.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <SectionHead title="Localization" subtitle="Currency, timezone and language used across the dashboard." />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Preferred currency">
            <Select value={form.preferred_currency} onValueChange={(v) => { setForm({ ...form, preferred_currency: v }); mut.mutate({ preferred_currency: v }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "NGN", "ZAR", "INR", "JPY", "BRL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Timezone">
            <Input value={form.timezone} maxLength={64}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              onBlur={() => mut.mutate({ timezone: form.timezone })} placeholder="UTC" />
          </Field>
          <Field label="Language">
            <Select value={form.locale} onValueChange={(v) => { setForm({ ...form, locale: v }); mut.mutate({ locale: v }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["en", "English"], ["es", "Español"], ["fr", "Français"], ["pt", "Português"], ["de", "Deutsch"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="surface p-5">
        <SectionHead title="Telegram" subtitle="Receive trade alerts and run trades from the bot." />
        {data.profile?.telegram_user_id ? (
          <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            ✅ Linked as @{data.profile.telegram_username ?? "unknown"}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <Button onClick={async () => { try { setTg(await link()); } catch (e) { toast.error((e as Error).message); } }}>
              Generate link code
            </Button>
            {tg && (
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm">
                {tg.deep_link
                  ? <>Open <a href={tg.deep_link} className="text-primary underline" target="_blank" rel="noreferrer">{tg.deep_link}</a> or send <code className="font-mono">/link {tg.code}</code> to the bot.</>
                  : <>Send <code className="font-mono">/link {tg.code}</code> to the bot. Code expires in 10 minutes.</>}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Security ---------------- */

function SecurityTab({ email }: { email: string | null }) {
  const change = useServerFn(changePassword);
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = async () => {
    if (pw.length < 8) return toast.error("Min 8 chars");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try { await change({ data: { new_password: pw } }); toast.success("Password updated"); setPw(""); setPw2(""); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <SectionHead title="Account" subtitle="Signed in as the email below." icon={<Lock className="h-4 w-4 text-primary" />} />
        <div className="mt-3 flex items-center justify-between rounded-md border border-border/50 bg-background/40 p-3">
          <span className="text-sm">{email ?? "—"}</span>
          <Badge variant="outline">Verified</Badge>
        </div>
      </section>

      <section className="surface p-5">
        <SectionHead title="Change password" subtitle="Use at least 8 characters. You'll be required to sign in again on other devices." />
        <div className="mt-3 grid max-w-md gap-3">
          <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirm new password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <div><Button onClick={onChange} disabled={busy}>{busy ? "Updating…" : "Update password"}</Button></div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Wallet (preferences + withdrawal policy) ---------------- */

function WalletTab({ data }: { data: SettingsData }) {
  const save = useServerFn(updateMySettings);
  const savePolicy = useServerFn(updateWithdrawalPolicy);
  const qc = useQueryClient();

  const [btc, setBtc] = useState(data.profile?.wallet_address_btc ?? "");
  const [method, setMethod] = useState<"lightning" | "onchain">(data.profile?.default_withdrawal_method ?? "lightning");

  const p = data.policy;
  const [perTx, setPerTx] = useState(((p?.per_tx_limit_sats ?? 50_000_000) / SATS).toString());
  const [daily, setDaily] = useState(((p?.daily_limit_sats ?? 100_000_000) / SATS).toString());
  const [twoFA, setTwoFA] = useState(((p?.require_2fa_above_sats ?? 10_000_000) / SATS).toString());
  const [whitelistOnly, setWhitelistOnly] = useState(p?.whitelist_only ?? false);
  const [whitelist, setWhitelist] = useState((p?.whitelist_addresses ?? []).join("\n"));
  const [cooldown, setCooldown] = useState((p?.cooldown_hours ?? 0).toString());
  const [notifyEmail, setNotifyEmail] = useState(p?.notify_email ?? true);
  const [notifyTg, setNotifyTg] = useState(p?.notify_telegram ?? true);

  const inv = () => qc.invalidateQueries({ queryKey: ["my-settings"] });

  const onSavePrefs = async () => {
    try {
      await save({ data: { wallet_address_btc: btc || null, default_withdrawal_method: method } });
      toast.success("Wallet preferences saved"); inv();
    } catch (e) { toast.error((e as Error).message); }
  };

  const onSavePolicy = async () => {
    try {
      const addrs = whitelist.split("\n").map((s) => s.trim()).filter(Boolean);
      await savePolicy({ data: {
        per_tx_limit_sats: Math.floor(Number(perTx) * SATS),
        daily_limit_sats: Math.floor(Number(daily) * SATS),
        require_2fa_above_sats: Math.floor(Number(twoFA) * SATS),
        whitelist_only: whitelistOnly,
        whitelist_addresses: addrs,
        cooldown_hours: Number(cooldown) || 0,
        notify_email: notifyEmail,
        notify_telegram: notifyTg,
      } });
      toast.success("Withdrawal policy updated"); inv();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <SectionHead title="Wallet preferences" subtitle="Default payout method and your verified BTC address." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Default withdrawal method">
            <Select value={method} onValueChange={(v) => setMethod(v as "lightning" | "onchain")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lightning">⚡ Lightning</SelectItem>
                <SelectItem value="onchain">₿ On-chain BTC</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="BTC on-chain address (payout)">
            <Input value={btc} onChange={(e) => setBtc(e.target.value)} placeholder="bc1q…" />
          </Field>
        </div>
        <div className="mt-3"><Button onClick={onSavePrefs}>Save preferences</Button></div>
      </section>

      <section className="surface p-5">
        <SectionHead
          title="Withdrawal security"
          subtitle="Caps and rules applied to every payout request before admin review."
          icon={<Shield className="h-4 w-4 text-primary" />}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Per-transaction limit (BTC)"><Input inputMode="decimal" value={perTx} onChange={(e) => setPerTx(e.target.value)} /></Field>
          <Field label="Daily limit (BTC)"><Input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} /></Field>
          <Field label="Require 2FA above (BTC)"><Input inputMode="decimal" value={twoFA} onChange={(e) => setTwoFA(e.target.value)} /></Field>
          <Field label="Cooldown between withdrawals (hours)"><Input inputMode="numeric" value={cooldown} onChange={(e) => setCooldown(e.target.value)} /></Field>
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2 sm:col-span-2">
            <div>
              <Label className="text-sm">Whitelist-only withdrawals</Label>
              <p className="text-[11px] text-muted-foreground">Block payouts to any address not on the list below.</p>
            </div>
            <Switch checked={whitelistOnly} onCheckedChange={setWhitelistOnly} />
          </div>
          <div className="sm:col-span-3">
            <Field label="Whitelisted addresses (one per line)">
              <Textarea rows={4} value={whitelist} onChange={(e) => setWhitelist(e.target.value)} placeholder="bc1q…&#10;lnbc…" />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
            <Label className="text-sm">Email me on withdrawal events</Label>
            <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2">
            <Label className="text-sm">Telegram alerts</Label>
            <Switch checked={notifyTg} onCheckedChange={setNotifyTg} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={onSavePolicy}>Save policy</Button>
          <span className="text-xs text-muted-foreground">
            Current cap · <strong>{fmtBtc(Number(perTx) * SATS)} BTC</strong> per tx, <strong>{fmtBtc(Number(daily) * SATS)} BTC</strong>/day
          </span>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Privacy ---------------- */

function PrivacyTab({ data }: { data: SettingsData }) {
  const save = useServerFn(updateMySettings);
  const qc = useQueryClient();
  const [state, setState] = useState({
    email_public: data.profile?.email_public ?? false,
    show_trade_history: data.profile?.show_trade_history ?? true,
    show_online_status: data.profile?.show_online_status ?? true,
  });
  const toggle = async (k: keyof typeof state, v: boolean) => {
    setState((s) => ({ ...s, [k]: v }));
    try { await save({ data: { [k]: v } }); qc.invalidateQueries({ queryKey: ["my-settings"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  const Row = ({ k, label, hint }: { k: keyof typeof state; label: string; hint: string }) => (
    <div className="flex items-start justify-between rounded-md border border-border/50 bg-background/40 px-3 py-3">
      <div className="pr-4">
        <Label className="text-sm">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={state[k]} onCheckedChange={(v) => toggle(k, v)} />
    </div>
  );
  return (
    <div className="surface space-y-3 p-5">
      <SectionHead title="Privacy controls" subtitle="Decide what other traders can see on your public profile." />
      <Row k="email_public"        label="Show email on public profile" hint="Off by default. Recommended off." />
      <Row k="show_trade_history"  label="Show trade history"            hint="Lets buyers verify your completed escrows." />
      <Row k="show_online_status"  label="Show online status"            hint="Display a green dot when you're active." />
    </div>
  );
}

/* ---------------- API tokens ---------------- */

function TokensTab({ tokens }: { tokens: SettingsData["tokens"] }) {
  const create = useServerFn(createApiToken);
  const revoke = useServerFn(revokeApiToken);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [created, setCreated] = useState<string | null>(null);

  const inv = () => qc.invalidateQueries({ queryKey: ["my-settings"] });

  const onCreate = async () => {
    if (name.trim().length < 2) return toast.error("Name required");
    try {
      const r = await create({ data: { name, scopes: scopes as ("read" | "trade" | "withdraw")[] } });
      setCreated(r.token); setName(""); setScopes(["read"]); inv();
    } catch (e) { toast.error((e as Error).message); }
  };
  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this token? Any integration using it will stop working.")) return;
    try { await revoke({ data: { id } }); toast.success("Token revoked"); inv(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  return (
    <div className="surface space-y-4 p-5">
      <div className="flex items-center justify-between">
        <SectionHead title="API tokens" subtitle="For bots, scripts and external automations. Tokens are shown once — store securely." />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreated(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New token</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{created ? "Token created" : "Create API token"}</DialogTitle></DialogHeader>
            {created ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Copy this token now — you won't see it again.</p>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 p-2">
                  <code className="flex-1 break-all font-mono text-xs">{created}</code>
                  <Button size="icon" variant="ghost" onClick={() => copy(created)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Token name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My trading bot" /></Field>
                <Field label="Scopes">
                  <div className="flex flex-wrap gap-2">
                    {(["read", "trade", "withdraw"] as const).map((s) => {
                      const on = scopes.includes(s);
                      return (
                        <button key={s} type="button"
                          onClick={() => setScopes(on ? scopes.filter((x) => x !== s) : [...scopes, s])}
                          className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                {scopes.includes("withdraw") && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Withdraw scope can request payouts on your behalf — use carefully.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              {created
                ? <Button onClick={() => { setOpen(false); setCreated(null); }}>Done</Button>
                : <Button onClick={onCreate}>Create token</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tokens.length === 0 && <p className="text-sm text-muted-foreground">No tokens yet.</p>}
      <div className="space-y-2">
        {tokens.map((t) => {
          const revoked = !!t.revoked_at;
          return (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <code className="font-mono text-xs text-muted-foreground">{t.prefix}…</code>
                  {revoked && <Badge variant="outline" className="border-destructive/40 text-destructive">Revoked</Badge>}
                  {!revoked && t.expires_at && new Date(t.expires_at) < new Date() && <Badge variant="outline">Expired</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>scopes: {t.scopes.join(", ")}</span>
                  <span>· last used {fmtAgo(t.last_used_at)}</span>
                  <span>· created {fmtAgo(t.created_at)}</span>
                </div>
              </div>
              {!revoked && (
                <Button size="sm" variant="ghost" onClick={() => onRevoke(t.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Revoke
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Devices ---------------- */

function DevicesTab({ devices }: { devices: SettingsData["devices"] }) {
  const revoke = useServerFn(revokeTrustedDevice);
  const qc = useQueryClient();
  const onRevoke = async (id: string) => {
    if (!confirm("Remove this device?")) return;
    try { await revoke({ data: { id } }); toast.success("Device removed"); qc.invalidateQueries({ queryKey: ["my-settings"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="surface space-y-3 p-5">
      <SectionHead title="Trusted devices" subtitle="Devices that bypass extra verification at sign-in." />
      {devices.length === 0 && <p className="text-sm text-muted-foreground">No trusted devices yet. They'll appear here after you mark a device as trusted at sign-in.</p>}
      <div className="space-y-2">
        {devices.map((d) => {
          const revoked = !!d.revoked_at;
          return (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{d.label ?? "Unnamed device"}</span>
                  {revoked && <Badge variant="outline" className="border-destructive/40 text-destructive">Revoked</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {d.user_agent ?? "Unknown agent"} · {d.ip ?? "—"} · last seen {fmtAgo(d.last_seen_at)}
                </div>
              </div>
              {!revoked && (
                <Button size="sm" variant="ghost" onClick={() => onRevoke(d.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Activity ---------------- */

function ActivityTab({ events }: { events: SettingsData["events"] }) {
  return (
    <div className="surface space-y-3 p-5">
      <SectionHead title="Recent security activity" subtitle="The last 50 sensitive events on your account. Logs are immutable." />
      {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
      <div className="space-y-1.5">
        {events.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-background/40 p-2.5 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <SeverityDot severity={e.severity} />
                <span className="font-medium">{e.kind.replace(/_/g, " ")}</span>
                <span className="text-[11px] text-muted-foreground">{fmtAgo(e.created_at)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {e.ip ?? "—"} · {e.user_agent ?? "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function SectionHead({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const cls = severity === "critical" ? "bg-destructive" : severity === "warning" ? "bg-amber-500" : "bg-emerald-500";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} aria-label={severity} />;
}

// Avoid unused-import warnings for icons used only conditionally
void Send;
