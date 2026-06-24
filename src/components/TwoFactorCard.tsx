import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, ShieldOff, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getTotpStatus, beginTotpEnroll, activateTotp,
  disableTotp, regenerateRecoveryCodes,
} from "@/lib/totp.functions";

export function TwoFactorCard() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getTotpStatus);
  const begin = useServerFn(beginTotpEnroll);
  const activate = useServerFn(activateTotp);
  const disable = useServerFn(disableTotp);
  const regen = useServerFn(regenerateRecoveryCodes);

  const { data: status, isLoading } = useQuery({
    queryKey: ["totp-status"],
    queryFn: () => fetchStatus(),
  });

  const [enroll, setEnroll] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [regenCode, setRegenCode] = useState("");

  const inv = () => qc.invalidateQueries({ queryKey: ["totp-status"] });

  const onBegin = async () => {
    setBusy(true);
    try { setEnroll(await begin()); setCode(""); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const onActivate = async () => {
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const r = await activate({ data: { code: code.trim() } });
      setRecovery(r.recovery_codes);
      setEnroll(null);
      setCode("");
      toast.success("Two-factor authentication enabled");
      inv();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await disable({ data: { code: disableCode.trim() } });
      toast.success("2FA disabled");
      setShowDisable(false); setDisableCode(""); inv();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const onRegen = async () => {
    setBusy(true);
    try {
      const r = await regen({ data: { code: regenCode.trim() } });
      setRecovery(r.recovery_codes);
      setShowRegen(false); setRegenCode(""); inv();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (isLoading) {
    return <section className="surface p-5 text-sm text-muted-foreground">Loading 2FA status…</section>;
  }

  return (
    <section className="surface p-5 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Two-factor authentication</h3>
          {status?.enabled
            ? <Badge className="bg-green-500/15 text-green-700 dark:text-green-400" variant="secondary">Enabled</Badge>
            : <Badge variant="outline">Disabled</Badge>}
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Required for fund-moving and admin actions in Telegram (<code>/release</code>, <code>/dispute</code>, <code>/ban</code>, etc.).
        Append the 6-digit code from your authenticator as the last argument of the command.
      </p>

      {!status?.enabled && !enroll && (
        <Button onClick={onBegin} disabled={busy}>
          {busy ? "…" : "Enable 2FA"}
        </Button>
      )}

      {enroll && (
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-4">
          <p className="text-sm">
            Scan with Google Authenticator, Authy, 1Password, or any TOTP app — or paste the secret manually.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="bg-white p-3 rounded">
              <QRCodeSVG value={enroll.otpauth} size={180} includeMargin={false} />
            </div>
            <div className="flex-1 w-full space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Secret</div>
              <div className="flex gap-2">
                <code className="font-mono text-xs break-all bg-muted p-2 rounded flex-1 select-all">{enroll.secret}</code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(enroll.secret); toast.success("Copied");
                }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground pt-2">Verify code</div>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric" pattern="\d*" maxLength={6}
                  placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <Button onClick={onActivate} disabled={busy}>Activate</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status?.enabled && !enroll && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRegen(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Regenerate recovery codes
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDisable(true)}>
            <ShieldOff className="h-3.5 w-3.5 mr-1" />
            Disable 2FA
          </Button>
          <span className="self-center text-xs text-muted-foreground">
            {status.recovery_codes_remaining} recovery codes remaining
          </span>
        </div>
      )}

      {/* Recovery-code reveal dialog */}
      <Dialog open={!!recovery} onOpenChange={(o) => !o && setRecovery(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your recovery codes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Store these somewhere safe. Each can be used once if you lose your authenticator.
            <strong className="block mt-1 text-foreground">You will not see them again.</strong>
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recovery?.map((c) => <code key={c} className="bg-muted p-2 rounded text-center">{c}</code>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText((recovery ?? []).join("\n"));
              toast.success("Copied all codes");
            }}>Copy all</Button>
            <Button onClick={() => setRecovery(null)}>I have saved them</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disable 2FA</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Enter your current 6-digit code or a recovery code.</p>
          <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456 or XXXX-XXXX" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisable(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDisable} disabled={busy}>Disable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate codes dialog */}
      <Dialog open={showRegen} onOpenChange={setShowRegen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Regenerate recovery codes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All existing recovery codes will be invalidated. Enter a current 6-digit code to continue.</p>
          <Input
            inputMode="numeric" maxLength={6}
            value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegen(false)}>Cancel</Button>
            <Button onClick={onRegen} disabled={busy}>Generate new codes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
