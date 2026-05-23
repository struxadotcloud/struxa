"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Check, Key, Plus, Trash2, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";
import { toast } from "sonner";

type Tab = "profile" | "api-keys" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "api-keys", label: "API Keys" },
  { id: "billing", label: "Billing" },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "CZ", name: "Czech Republic" },
];

function inputClass(mono?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${mono ? " font-mono" : ""}`;
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 40);
}

// ─────────────────────────────────────────────
// Profile Tab (includes security)
// ─────────────────────────────────────────────
function ProfileTab() {
  const { data: self, isLoading } = useQuery(orpc.users.getSelf.queryOptions());
  const { data: session } = authClient.useSession();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (self) setName(self.name ?? "");
  }, [self]);

  const updateProfile = useMutation(
    orpc.users.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    }),
  );

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Personal Information">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Display Name</label>
            <input
              className={inputClass()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Email</label>
            <input
              className={`${inputClass()} cursor-not-allowed opacity-60`}
              value={session?.user.email ?? ""}
              readOnly
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={updateProfile.isPending || !name.trim()}
            onClick={() => updateProfile.mutate({ name: name.trim() })}
            className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {updateProfile.isPending ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-xs font-medium text-green-500">Saved</span>}
          {updateProfile.isError && (
            <span className="text-xs text-destructive">{updateProfile.error.message}</span>
          )}
        </div>
      </SectionCard>

      <SecurityContent twoFactorEnabled={self?.twoFactorEnabled ?? false} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Security Content (embedded in Profile tab)
// ─────────────────────────────────────────────
function SecurityContent({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const { data: session } = authClient.useSession();
  const { data: sessions, refetch: refetchSessions } = useQuery(orpc.users.listSessions.queryOptions());
  const revokeSession = useMutation(
    orpc.users.revokeSession.mutationOptions({ onSuccess: () => void refetchSessions() }),
  );
  const [tfaDialog, setTfaDialog] = useState<"enable" | "disable" | "backup" | null>(null);
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaCode, setTfaCode] = useState("");
  const [tfaStep, setTfaStep] = useState<"password" | "scan" | "verify">("password");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [tfaError, setTfaError] = useState("");
  const [tfaPending, setTfaPending] = useState(false);

  function resetTfaDialog() {
    setTfaDialog(null);
    setTfaPassword("");
    setTfaCode("");
    setTfaStep("password");
    setTotpUri("");
    setBackupCodes([]);
    setTfaError("");
  }

  async function handleEnableTfa() {
    setTfaError("");
    setTfaPending(true);
    try {
      const res = await authClient.twoFactor.enable({ password: tfaPassword });
      if (res.error) throw new Error(res.error.message);
      setTotpUri(res.data?.totpURI ?? "");
      setBackupCodes(res.data?.backupCodes ?? []);
      setTfaStep("scan");
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : "Failed to enable 2FA");
    } finally {
      setTfaPending(false);
    }
  }

  async function handleVerifyTfa() {
    setTfaError("");
    setTfaPending(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: tfaCode });
      if (res.error) throw new Error(res.error.message);
      await authClient.$fetch("/api/auth/get-session", { method: "GET" });
      toast.success("Two-factor authentication enabled");
      resetTfaDialog();
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setTfaPending(false);
    }
  }

  async function handleDisableTfa() {
    setTfaError("");
    setTfaPending(true);
    try {
      const res = await authClient.twoFactor.disable({ password: tfaPassword });
      if (res.error) throw new Error(res.error.message);
      toast.success("Two-factor authentication disabled");
      resetTfaDialog();
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setTfaPending(false);
    }
  }

  async function handleGenerateBackupCodes() {
    setTfaError("");
    setTfaPending(true);
    try {
      const res = await authClient.twoFactor.generateBackupCodes({ password: tfaPassword });
      if (res.error) throw new Error(res.error.message);
      setBackupCodes(res.data?.backupCodes ?? []);
      setTfaStep("scan");
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : "Failed to generate backup codes");
    } finally {
      setTfaPending(false);
    }
  }

  function extractSecret(uri: string): string {
    try {
      const match = uri.match(/[?&]secret=([^&]+)/);
      return match ? (match[1] ?? "") : "";
    } catch {
      return "";
    }
  }

  const currentSessionToken = session?.session.token;

  return (
    <div className="flex flex-col gap-4">
      {/* 2FA Section */}
      <SectionCard title="Two-Factor Authentication" description="Add an extra layer of security to your account with TOTP.">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {twoFactorEnabled && (
              <button
                type="button"
                onClick={() => { setTfaDialog("backup"); setTfaStep("password"); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Backup Codes
              </button>
            )}
            <button
              type="button"
              onClick={() => { setTfaDialog(twoFactorEnabled ? "disable" : "enable"); setTfaStep("password"); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${twoFactorEnabled ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "bg-foreground text-background hover:opacity-80"}`}
            >
              {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Enable 2FA Dialog */}
      <Dialog open={tfaDialog === "enable"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {tfaStep === "password" && "Enter your password to continue."}
              {tfaStep === "scan" && "Scan the code or enter the key manually in your authenticator app."}
            </DialogDescription>
          </DialogHeader>

          {tfaStep === "password" && (
            <div className="px-5 py-4">
              <label className="mb-1.5 block text-xs font-medium text-foreground">Password</label>
              <input
                autoFocus
                type="password"
                className={inputClass()}
                placeholder="Your account password"
                value={tfaPassword}
                onChange={(e) => setTfaPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleEnableTfa(); }}
              />
              {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
            </div>
          )}

          {tfaStep === "scan" && (
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground">Manual entry key</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <code className="flex-1 font-mono text-xs break-all text-foreground">{extractSecret(totpUri)}</code>
                  <CopyButton text={extractSecret(totpUri)} />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground">Full URI</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <code className="flex-1 font-mono text-[10px] break-all text-muted-foreground">{totpUri}</code>
                  <CopyButton text={totpUri} />
                </div>
              </div>
              {backupCodes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground">Backup codes <span className="text-muted-foreground font-normal">(save these somewhere safe)</span></p>
                  <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
                    {backupCodes.map((code) => (
                      <code key={code} className="font-mono text-xs text-foreground">{code}</code>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Verification code</label>
                <input
                  autoFocus
                  className={inputClass(true)}
                  placeholder="6-digit code"
                  maxLength={6}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleVerifyTfa(); }}
                />
                {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={tfaPending}
              onClick={resetTfaDialog}
            >
              Cancel
            </DialogClose>
            {tfaStep === "password" && (
              <button
                type="button"
                disabled={tfaPending || !tfaPassword}
                onClick={() => void handleEnableTfa()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? "Continuing…" : "Continue"}
              </button>
            )}
            {tfaStep === "scan" && (
              <button
                type="button"
                disabled={tfaPending || tfaCode.length < 6}
                onClick={() => void handleVerifyTfa()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? "Verifying…" : "Verify & Enable"}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={tfaDialog === "disable"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter your password to confirm.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <input
              autoFocus
              type="password"
              className={inputClass()}
              placeholder="Your account password"
              value={tfaPassword}
              onChange={(e) => setTfaPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleDisableTfa(); }}
            />
            {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={tfaPending}
              onClick={resetTfaDialog}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              disabled={tfaPending || !tfaPassword}
              onClick={() => void handleDisableTfa()}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {tfaPending ? "Disabling…" : "Disable 2FA"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={tfaDialog === "backup"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              {tfaStep === "password" ? "Enter your password to generate new backup codes." : "Save these codes in a safe place. Each code can only be used once."}
            </DialogDescription>
          </DialogHeader>
          {tfaStep === "password" && (
            <div className="px-5 py-4">
              <input
                autoFocus
                type="password"
                className={inputClass()}
                placeholder="Your account password"
                value={tfaPassword}
                onChange={(e) => setTfaPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleGenerateBackupCodes(); }}
              />
              {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
            </div>
          )}
          {tfaStep === "scan" && (
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
                {backupCodes.map((code) => (
                  <code key={code} className="font-mono text-xs text-foreground">{code}</code>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Previous backup codes are now invalid.</p>
            </div>
          )}
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={resetTfaDialog}
            >
              {tfaStep === "scan" ? "Done" : "Cancel"}
            </DialogClose>
            {tfaStep === "password" && (
              <button
                type="button"
                disabled={tfaPending || !tfaPassword}
                onClick={() => void handleGenerateBackupCodes()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? "Generating…" : "Generate"}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Active Sessions */}
      <SectionCard title="Active Sessions" description="All devices currently signed in to your account.">
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions found.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {sessions.map((s) => {
              const isCurrent = s.token === currentSessionToken;
              return (
                <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {parseUserAgent(s.userAgent)}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">current</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ipAddress ?? "Unknown IP"} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={revokeSession.isPending}
                      onClick={() => revokeSession.mutate({ sessionToken: s.token })}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
                    >
                      <LogOut className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// API Keys Tab
// ─────────────────────────────────────────────
function ApiKeysTab() {
  type ApiKey = { id: string; name: string | null; start: string | null; prefix: string | null; createdAt: Date; lastRequest: Date | null; enabled: boolean | null };
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState(false);

  async function loadKeys() {
    setLoadingKeys(true);
    try {
      const res = await authClient.apiKey.list();
      if (res.data) setKeys((res.data as unknown as { apiKeys: ApiKey[] }).apiKeys ?? (res.data as unknown as ApiKey[]));
    } finally {
      setLoadingKeys(false);
    }
  }

  useEffect(() => { void loadKeys(); }, []);

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await authClient.apiKey.create({ name: newKeyName.trim() });
      if (res.error) throw new Error(res.error.message);
      setNewKeyValue((res.data as { key?: string })?.key ?? null);
      setNewKeyName("");
      await loadKeys();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    setDeletingKey(true);
    try {
      const res = await authClient.apiKey.delete({ keyId });
      if (res.error) throw new Error(res.error.message);
      await loadKeys();
      setDeleteKeyId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete API key");
    } finally {
      setDeletingKey(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="API Keys" description="Use API keys to authenticate programmatic access to the API.">
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCreateDialog(true)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Key
          </button>
        </div>

        {loadingKeys ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Key className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{key.name ?? "Unnamed key"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.prefix ? `${key.prefix}_` : ""}{key.start ? `${key.start}…` : "•••"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Created {new Date(key.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {key.lastRequest && ` · Last used ${new Date(key.lastRequest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteKeyId(key.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Create Key Dialog */}
      <Dialog open={createDialog} onOpenChange={(open) => { if (!open) { setCreateDialog(false); setNewKeyName(""); setNewKeyValue(null); } }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{newKeyValue ? "API Key Created" : "Create API Key"}</DialogTitle>
            <DialogDescription>
              {newKeyValue
                ? "Copy your key now — it won't be shown again."
                : "Give your key a name to identify it later."}
            </DialogDescription>
          </DialogHeader>
          {!newKeyValue ? (
            <div className="px-5 py-4">
              <input
                autoFocus
                className={inputClass()}
                placeholder="e.g. My App"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateKey(); }}
              />
            </div>
          ) : (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <code className="flex-1 font-mono text-xs break-all text-foreground">{newKeyValue}</code>
                <CopyButton text={newKeyValue} />
              </div>
            </div>
          )}
          <DialogFooter>
            {!newKeyValue ? (
              <>
                <DialogClose
                  className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  disabled={creatingKey}
                >
                  Cancel
                </DialogClose>
                <button
                  type="button"
                  disabled={creatingKey || !newKeyName.trim()}
                  onClick={() => void handleCreateKey()}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {creatingKey ? "Creating…" : "Create"}
                </button>
              </>
            ) : (
              <DialogClose
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                onClick={() => { setCreateDialog(false); setNewKeyValue(null); }}
              >
                Done
              </DialogClose>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Delete Key Dialog */}
      <Dialog open={!!deleteKeyId} onOpenChange={(open) => { if (!open) setDeleteKeyId(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete API key?</DialogTitle>
            <DialogDescription>Any applications using this key will stop working immediately.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={deletingKey}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              disabled={deletingKey}
              onClick={() => { if (deleteKeyId) void handleDeleteKey(deleteKeyId); }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {deletingKey ? "Deleting…" : "Delete Key"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Billing Tab
// ─────────────────────────────────────────────
function BillingTab() {
  const { data: self, isLoading } = useQuery(orpc.users.getSelf.queryOptions());
  const [saved, setSaved] = useState(false);

  const [billing, setBilling] = useState({
    billingName: "",
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingCity: "",
    billingState: "",
    billingPostalCode: "",
    billingCountry: "",
    vatNumber: "",
    vatCountry: "",
  });

  useEffect(() => {
    if (!self) return;
    setBilling({
      billingName: self.billingName ?? "",
      billingAddressLine1: self.billingAddressLine1 ?? "",
      billingAddressLine2: self.billingAddressLine2 ?? "",
      billingCity: self.billingCity ?? "",
      billingState: self.billingState ?? "",
      billingPostalCode: self.billingPostalCode ?? "",
      billingCountry: self.billingCountry ?? "",
      vatNumber: self.vatNumber ?? "",
      vatCountry: self.vatCountry ?? "",
    });
  }, [self]);

  const updateBilling = useMutation(
    orpc.users.updateBilling.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    }),
  );

  function set(field: keyof typeof billing, value: string) {
    setBilling((prev) => ({ ...prev, [field]: value }));
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Billing Address">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Full Name / Company</label>
            <input className={inputClass()} value={billing.billingName} onChange={(e) => set("billingName", e.target.value)} placeholder="Acme Inc." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Address Line 1</label>
            <input className={inputClass()} value={billing.billingAddressLine1} onChange={(e) => set("billingAddressLine1", e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Address Line 2 <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input className={inputClass()} value={billing.billingAddressLine2} onChange={(e) => set("billingAddressLine2", e.target.value)} placeholder="Suite 400" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">City</label>
              <input className={inputClass()} value={billing.billingCity} onChange={(e) => set("billingCity", e.target.value)} placeholder="New York" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">State / Province</label>
              <input className={inputClass()} value={billing.billingState} onChange={(e) => set("billingState", e.target.value)} placeholder="NY" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Postal Code</label>
              <input className={inputClass()} value={billing.billingPostalCode} onChange={(e) => set("billingPostalCode", e.target.value)} placeholder="10001" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Country</label>
            <select
              className={`${inputClass()} bg-background`}
              value={billing.billingCountry}
              onChange={(e) => set("billingCountry", e.target.value)}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="VAT Information" description="Required for EU businesses to receive invoices without VAT.">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">VAT Number</label>
            <input className={inputClass(true)} value={billing.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder="DE123456789" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">VAT Country</label>
            <select
              className={`${inputClass()} bg-background`}
              value={billing.vatCountry}
              onChange={(e) => set("vatCountry", e.target.value)}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={updateBilling.isPending}
          onClick={() => updateBilling.mutate({
            billingName: billing.billingName || undefined,
            billingAddressLine1: billing.billingAddressLine1 || undefined,
            billingAddressLine2: billing.billingAddressLine2 || undefined,
            billingCity: billing.billingCity || undefined,
            billingState: billing.billingState || undefined,
            billingPostalCode: billing.billingPostalCode || undefined,
            billingCountry: billing.billingCountry || undefined,
            vatNumber: billing.vatNumber || undefined,
            vatCountry: billing.vatCountry || undefined,
          })}
          className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {updateBilling.isPending ? "Saving…" : "Save Billing"}
        </button>
        {saved && <span className="text-xs font-medium text-green-500">Saved</span>}
        {updateBilling.isError && <span className="text-xs text-destructive">{updateBilling.error.message}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function AccountPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-2xl">
          {tab === "profile" && <ProfileTab />}
          {tab === "api-keys" && <ApiKeysTab />}
          {tab === "billing" && <BillingTab />}
        </div>
      </div>
    </>
  );
}
