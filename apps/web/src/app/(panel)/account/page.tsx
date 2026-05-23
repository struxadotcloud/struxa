"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Copy, Check, Key, Plus, Trash2, Monitor, LogOut, Camera, Link2, Unlink, Download } from "lucide-react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@struxa/ui/components/select";
import ReactCountryFlag from "react-country-flag";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";
import { toast } from "sonner";

type Tab = "profile" | "api-keys" | "billing";

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

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.02.015.04.03.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const PROVIDER_META: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  github: { label: "GitHub", icon: GithubIcon },
  discord: { label: "Discord", icon: DiscordIcon },
};

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
  const t = useTranslations("common");
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
      {copied ? t("copied") : t("copy")}
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

type LinkedAccount = { id: string; providerId: string; accountId: string };

// ─────────────────────────────────────────────
// Connected Accounts
// ─────────────────────────────────────────────
function ConnectedAccountsSection({ accounts, onRefresh }: { accounts: LinkedAccount[]; onRefresh: () => Promise<void> }) {
  const t = useTranslations("account.connectedAccounts");
  const tc = useTranslations("common");
  const { data: providers } = useQuery(orpc.settings.getActiveSocialProviders.queryOptions());
  const [pending, setPending] = useState<string | null>(null);

  async function handleLink(provider: string) {
    setPending(provider);
    try {
      await authClient.linkSocial({ provider: provider as never, callbackURL: "/account" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("linkFailed"));
      setPending(null);
    }
  }

  async function handleUnlink(providerId: string) {
    setPending(providerId);
    try {
      const res = await authClient.unlinkAccount({ providerId });
      if (res.error) throw new Error(res.error.message);
      toast.success(t("unlinked"));
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("unlinkFailed"));
    } finally {
      setPending(null);
    }
  }

  if (!providers || providers.length === 0) return null;

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const meta = PROVIDER_META[provider];
          if (!meta) return null;
          const linked = accounts.some((a) => a.providerId === provider);
          const Icon = meta.icon;
          return (
            <div key={provider} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">{meta.label}</span>
                {linked && (
                  <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">{t("linked")}</span>
                )}
              </div>
              <button
                type="button"
                disabled={!!pending}
                onClick={() => void (linked ? handleUnlink(provider) : handleLink(provider))}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${linked ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "bg-foreground text-background hover:opacity-80"}`}
              >
                {pending === provider ? (
                  "…"
                ) : linked ? (
                  <><Unlink className="h-3 w-3" />{tc("unlink")}</>
                ) : (
                  <><Link2 className="h-3 w-3" />{tc("link")}</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────
// Password Section
// ─────────────────────────────────────────────
function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("account.password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (newPassword !== confirmPassword) { setError(t("passwordsDoNotMatch")); return; }
    if (newPassword.length < 8) { setError(t("passwordTooShort")); return; }
    setError("");
    setPending(true);
    try {
      if (hasPassword) {
        const res = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.$fetch("/api/auth/set-password", { method: "POST", body: { newPassword } });
        if ((res as { error?: { message?: string } }).error) throw new Error((res as { error?: { message?: string } }).error?.message ?? "Failed");
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title={hasPassword ? t("changeTitle") : t("setTitle")}
      description={hasPassword ? t("changeDescription") : t("setDescription")}
    >
      <div className="flex flex-col gap-3">
        {hasPassword && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("currentPasswordLabel")}</label>
            <input
              type="password"
              className={inputClass()}
              placeholder={t("currentPasswordPlaceholder")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">{t("newPasswordLabel")}</label>
          <input
            type="password"
            className={inputClass()}
            placeholder={t("newPasswordPlaceholder")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">{t("confirmPasswordLabel")}</label>
          <input
            type="password"
            className={inputClass()}
            placeholder={t("confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
            onClick={() => void handleSubmit()}
            className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {pending ? t("saving") : hasPassword ? t("changePassword") : t("setPassword")}
          </button>
          {success && <span className="text-xs font-medium text-green-500">{t("saved")}</span>}
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────
// Locale Section
// ─────────────────────────────────────────────
const LOCALES = [
  { value: "en", label: "English", countryCode: "US" },
] as const;

function LocaleSection({ currentLocale }: { currentLocale: string }) {
  const t = useTranslations("account.locale");
  const [locale, setLocale] = useState(currentLocale);

  useEffect(() => { setLocale(currentLocale); }, [currentLocale]);

  const updateLocale = useMutation(
    orpc.users.updateLocale.mutationOptions({
      onSuccess: (_, { locale: newLocale }) => {
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        toast.success(t("saveSuccess"));
        void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
      },
      onError: () => {
        toast.error(t("saveFailed"));
      },
    }),
  );

  const selected = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <SectionCard title={t("sectionTitle")} description={t("sectionDescription")}>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
          <label className="text-xs font-medium text-foreground">{t("label")}</label>
          <Select value={locale} onValueChange={(value) => { if (value) setLocale(value); }}>
            <SelectTrigger>
              <SelectValue>
                <ReactCountryFlag
                  countryCode={selected!.countryCode}
                  svg
                  style={{ width: "1.1em", height: "1.1em", borderRadius: "2px" }}
                />
                {selected!.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  <ReactCountryFlag
                    countryCode={l.countryCode}
                    svg
                    style={{ width: "1.1em", height: "1.1em", borderRadius: "2px" }}
                  />
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          disabled={updateLocale.isPending || locale === currentLocale}
          onClick={() => updateLocale.mutate({ locale })}
          className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {updateLocale.isPending ? "…" : t("save")}
        </button>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────
// Profile Tab (includes security)
// ─────────────────────────────────────────────
function ProfileTab() {
  const t = useTranslations("account.profile");
  const { data: self, isLoading } = useQuery(orpc.users.getSelf.queryOptions());
  const { data: session } = authClient.useSession();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);

  async function loadLinkedAccounts() {
    const res = await authClient.listAccounts();
    if (res.data) setLinkedAccounts(res.data as LinkedAccount[]);
  }

  useEffect(() => { void loadLinkedAccounts(); }, []);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) {
      setAvatarError(t("avatarOnlyImages"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t("avatarTooLarge"));
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files/upload/avatar", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      await queryClient.invalidateQueries({ queryKey: orpc.users.key() });
      await authClient.$fetch("/api/auth/get-session");
      toast.success(t("avatarUpdated"));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">{t("loading" as never) ?? "Loading…"}</div>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t("personalInfoTitle")}>
        <div className="mb-4 flex items-center gap-3">
          <label htmlFor="avatar-upload" className={`group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full bg-muted ${avatarUploading ? "pointer-events-none" : ""}`}>
            {self?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={self.image} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-base font-semibold text-muted-foreground">
                {self?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              {avatarUploading
                ? <span className="text-[10px] text-white">…</span>
                : <Camera className="h-4 w-4 text-white" />}
            </div>
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={avatarUploading}
            onChange={(e) => void handleAvatarChange(e)}
          />
          {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("displayNameLabel")}</label>
            <input
              className={inputClass()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("displayNamePlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("emailLabel")}</label>
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
            {updateProfile.isPending ? t("saving") : t("save")}
          </button>
          {saved && <span className="text-xs font-medium text-green-500">{t("saved")}</span>}
          {updateProfile.isError && (
            <span className="text-xs text-destructive">{updateProfile.error.message}</span>
          )}
        </div>
      </SectionCard>

      <LocaleSection currentLocale={self?.locale ?? "en"} />
      <SecurityContent twoFactorEnabled={self?.twoFactorEnabled ?? false} />
      <ConnectedAccountsSection accounts={linkedAccounts} onRefresh={loadLinkedAccounts} />
      <PasswordSection hasPassword={linkedAccounts.some((a) => a.providerId === "credential")} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Security Content (embedded in Profile tab)
// ─────────────────────────────────────────────
function SecurityContent({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const t = useTranslations("account.security");
  const tc = useTranslations("common");
  const { data: session } = authClient.useSession();
  const { data: sessions, refetch: refetchSessions } = useQuery(orpc.users.listSessions.queryOptions());
  const revokeSession = useMutation(
    orpc.users.revokeSession.mutationOptions({ onSuccess: () => void refetchSessions() }),
  );
  const [tfaDialog, setTfaDialog] = useState<"enable" | "disable" | "backup" | null>(null);
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaCode, setTfaCode] = useState("");
  const [tfaStep, setTfaStep] = useState<"password" | "scan" | "codes">("password");
  const [showManualKey, setShowManualKey] = useState(false);
  const [totpUri, setTotpUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [tfaError, setTfaError] = useState("");
  const [tfaPending, setTfaPending] = useState(false);

  useEffect(() => {
    if (!totpUri) { setQrDataUrl(""); return; }
    void QRCode.toDataURL(totpUri, { width: 180, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [totpUri]);

  function downloadBackupCodes(codes: string[]) {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyAllBackupCodes(codes: string[]) {
    void navigator.clipboard.writeText(codes.join("\n"));
    toast.success(t("backupCodesCopied"));
  }

  function resetTfaDialog() {
    setTfaDialog(null);
    setTfaPassword("");
    setTfaCode("");
    setTfaStep("password");
    setShowManualKey(false);
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
      setTfaStep("codes");
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
      toast.success(t("tfaDisabled"));
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
      <SectionCard title={t("twoFactorTitle")} description={t("twoFactorDescription")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              {twoFactorEnabled ? t("twoFactorEnabled") : t("twoFactorDisabled")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {twoFactorEnabled && (
              <button
                type="button"
                onClick={() => { setTfaDialog("backup"); setTfaStep("password"); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("backupCodes")}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setTfaDialog(twoFactorEnabled ? "disable" : "enable"); setTfaStep("password"); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${twoFactorEnabled ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "bg-foreground text-background hover:opacity-80"}`}
            >
              {twoFactorEnabled ? t("disableTfa") : t("enableTfa")}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Enable 2FA Dialog */}
      <Dialog open={tfaDialog === "enable"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("enableTfaDialogTitle")}</DialogTitle>
            <DialogDescription>
              {tfaStep === "password" && t("enterPasswordDesc")}
              {tfaStep === "scan" && t("scanDesc")}
              {tfaStep === "codes" && t("codesDesc")}
            </DialogDescription>
          </DialogHeader>

          {tfaStep === "password" && (
            <div className="px-5 py-4">
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("passwordLabel")}</label>
              <input
                autoFocus
                type="password"
                className={inputClass()}
                placeholder={t("passwordPlaceholder")}
                value={tfaPassword}
                onChange={(e) => setTfaPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleEnableTfa(); }}
              />
              {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
            </div>
          )}

          {tfaStep === "scan" && (
            <div className="px-5 py-4 flex flex-col gap-3">
              {qrDataUrl && (
                <div className="flex justify-center">
                  <div className="rounded-xl border border-border bg-white p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowManualKey((v) => !v)}
                className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t("manualKeyToggle")}
              </button>
              {showManualKey && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <code className="flex-1 font-mono text-xs break-all text-foreground">{extractSecret(totpUri)}</code>
                  <CopyButton text={extractSecret(totpUri)} />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("verificationCode")}</label>
                <input
                  autoFocus
                  className={inputClass(true)}
                  placeholder={t("verificationCodePlaceholder")}
                  maxLength={6}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleVerifyTfa(); }}
                />
                {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
              </div>
            </div>
          )}

          {tfaStep === "codes" && (
            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">{t("yourBackupCodes")}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyAllBackupCodes(backupCodes)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {t("copyAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(backupCodes)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-2.5 w-2.5" />
                    {tc("download")}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
                {backupCodes.map((code) => (
                  <code key={code} className="font-mono text-xs text-foreground">{code}</code>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {tfaStep !== "codes" && (
              <DialogClose
                className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                disabled={tfaPending}
                onClick={resetTfaDialog}
              >
                {tc("cancel")}
              </DialogClose>
            )}
            {tfaStep === "password" && (
              <button
                type="button"
                disabled={tfaPending || !tfaPassword}
                onClick={() => void handleEnableTfa()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? t("continuing") : tc("continue")}
              </button>
            )}
            {tfaStep === "scan" && (
              <button
                type="button"
                disabled={tfaPending || tfaCode.length < 6}
                onClick={() => void handleVerifyTfa()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? t("verifying" as never) ?? "Verifying…" : t("verifyAndEnable")}
              </button>
            )}
            {tfaStep === "codes" && (
              <DialogClose
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                onClick={() => { toast.success(t("tfaEnabled")); resetTfaDialog(); }}
              >
                {tc("done")}
              </DialogClose>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={tfaDialog === "disable"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("disableTfaDialogTitle")}</DialogTitle>
            <DialogDescription>{t("disableTfaDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <input
              autoFocus
              type="password"
              className={inputClass()}
              placeholder={t("passwordPlaceholder")}
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
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={tfaPending || !tfaPassword}
              onClick={() => void handleDisableTfa()}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {tfaPending ? t("disabling") : t("disableTfa")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={tfaDialog === "backup"} onOpenChange={(open) => { if (!open) resetTfaDialog(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("backupCodesDialogTitle")}</DialogTitle>
            <DialogDescription>
              {tfaStep === "password" ? t("backupCodesDialogDescPassword") : t("backupCodesDialogDescCodes")}
            </DialogDescription>
          </DialogHeader>
          {tfaStep === "password" && (
            <div className="px-5 py-4">
              <input
                autoFocus
                type="password"
                className={inputClass()}
                placeholder={t("passwordPlaceholder")}
                value={tfaPassword}
                onChange={(e) => setTfaPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleGenerateBackupCodes(); }}
              />
              {tfaError && <p className="mt-2 text-xs text-destructive">{tfaError}</p>}
            </div>
          )}
          {tfaStep === "scan" && (
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{t("previousCodesInvalid")}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyAllBackupCodes(backupCodes)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {t("copyAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(backupCodes)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-2.5 w-2.5" />
                    {tc("download")}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
                {backupCodes.map((code) => (
                  <code key={code} className="font-mono text-xs text-foreground">{code}</code>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={resetTfaDialog}
            >
              {tfaStep === "scan" ? tc("done") : tc("cancel")}
            </DialogClose>
            {tfaStep === "password" && (
              <button
                type="button"
                disabled={tfaPending || !tfaPassword}
                onClick={() => void handleGenerateBackupCodes()}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {tfaPending ? t("generating") : tc("generate")}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Active Sessions */}
      <SectionCard title={t("sessionsTitle")} description={t("sessionsDescription")}>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
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
                          <span className="ml-2 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">{t("currentSession")}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ipAddress ?? t("unknownIp")} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                      {t("revokeSession")}
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
  const t = useTranslations("account.apiKeys");
  const tc = useTranslations("common");
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
      toast.error(e instanceof Error ? e.message : t("createFailed"));
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
      toast.error(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setDeletingKey(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t("title")} description={t("description")}>
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCreateDialog(true)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("createKey")}
          </button>
        </div>

        {loadingKeys ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Key className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("noKeysTitle")}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{key.name ?? t("unnamedKey")}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.prefix ? `${key.prefix}_` : ""}{key.start ? `${key.start}…` : "•••"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {key.lastRequest && ` · ${new Date(key.lastRequest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
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
            <DialogTitle>{newKeyValue ? t("createDialogTitleDone") : t("createDialogTitle")}</DialogTitle>
            <DialogDescription>
              {newKeyValue ? t("createDialogDescDone") : t("createDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          {!newKeyValue ? (
            <div className="px-5 py-4">
              <input
                autoFocus
                className={inputClass()}
                placeholder={t("keyNamePlaceholder")}
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
                  {tc("cancel")}
                </DialogClose>
                <button
                  type="button"
                  disabled={creatingKey || !newKeyName.trim()}
                  onClick={() => void handleCreateKey()}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {creatingKey ? t("creating") : t("create")}
                </button>
              </>
            ) : (
              <DialogClose
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                onClick={() => { setCreateDialog(false); setNewKeyValue(null); }}
              >
                {tc("done")}
              </DialogClose>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Delete Key Dialog */}
      <Dialog open={!!deleteKeyId} onOpenChange={(open) => { if (!open) setDeleteKeyId(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDialogDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={deletingKey}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={deletingKey}
              onClick={() => { if (deleteKeyId) void handleDeleteKey(deleteKeyId); }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {deletingKey ? t("deleting") : t("deleteKey")}
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
  const t = useTranslations("account.billing");
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
      <SectionCard title={t("addressTitle")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("fullNameLabel")}</label>
            <input className={inputClass()} value={billing.billingName} onChange={(e) => set("billingName", e.target.value)} placeholder={t("fullNamePlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("addressLine1Label")}</label>
            <input className={inputClass()} value={billing.billingAddressLine1} onChange={(e) => set("billingAddressLine1", e.target.value)} placeholder={t("addressLine1Placeholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("addressLine2Label")} <span className="text-muted-foreground font-normal">{t("addressLine2Optional")}</span></label>
            <input className={inputClass()} value={billing.billingAddressLine2} onChange={(e) => set("billingAddressLine2", e.target.value)} placeholder={t("addressLine2Placeholder")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("cityLabel")}</label>
              <input className={inputClass()} value={billing.billingCity} onChange={(e) => set("billingCity", e.target.value)} placeholder={t("cityPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("stateLabel")}</label>
              <input className={inputClass()} value={billing.billingState} onChange={(e) => set("billingState", e.target.value)} placeholder={t("statePlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("postalCodeLabel")}</label>
              <input className={inputClass()} value={billing.billingPostalCode} onChange={(e) => set("billingPostalCode", e.target.value)} placeholder={t("postalCodePlaceholder")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("countryLabel")}</label>
            <select
              className={`${inputClass()} bg-background`}
              value={billing.billingCountry}
              onChange={(e) => set("billingCountry", e.target.value)}
            >
              <option value="">{t("selectCountry")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("vatTitle")} description={t("vatDescription")}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("vatNumberLabel")}</label>
            <input className={inputClass(true)} value={billing.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder={t("vatNumberPlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">{t("vatCountryLabel")}</label>
            <select
              className={`${inputClass()} bg-background`}
              value={billing.vatCountry}
              onChange={(e) => set("vatCountry", e.target.value)}
            >
              <option value="">{t("selectCountry")}</option>
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
          {updateBilling.isPending ? t("saving") : t("saveBilling")}
        </button>
        {saved && <span className="text-xs font-medium text-green-500">{t("saved")}</span>}
        {updateBilling.isError && <span className="text-xs text-destructive">{updateBilling.error.message}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function AccountPage() {
  const t = useTranslations("account.tabs");
  const [tab, setTab] = useState<Tab>("profile");

  const TABS: { id: Tab; label: string }[] = [
    { id: "profile", label: t("profile") },
    { id: "api-keys", label: t("apiKeys") },
    { id: "billing", label: t("billing") },
  ];

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === tb.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.label}
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
