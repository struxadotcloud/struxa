"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Upload, X, Github, ChevronDown, RotateCcw, Copy, Mail, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { orpc, queryClient } from "@/utils/orpc";
import { DiscordPreview, GooglePreview, TwitterPreview, type SeoPreviewData } from "./_components/seo-previews";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@struxa/ui/components/select";

function invalidateSettings() {
  void queryClient.invalidateQueries({ queryKey: orpc.settings.key() });
}

type SavedKey = string;

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function inputClass(disabled?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${disabled ? " opacity-50 cursor-not-allowed" : ""}`;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${enabled ? "bg-foreground" : "bg-input"}`}
    >
      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function SaveButton({ saving, saved, disabled }: { saving: boolean; saved: boolean; disabled?: boolean }) {
  const tc = useTranslations("common");
  return (
    <button
      type="button"
      disabled={saving || disabled}
      className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
    >
      {saved ? <><Check className="h-3.5 w-3.5" /> {tc("saved")}</> : saving ? tc("saving") : tc("save")}
    </button>
  );
}

function ImageUploadField({
  label,
  description,
  accept,
  maxSizeMb,
  currentUrl,
  uploading,
  error,
  aspectHint,
  onUpload,
  onRemove,
}: {
  label: string;
  description: string;
  accept: string;
  maxSizeMb: number;
  currentUrl: string | null | undefined;
  uploading: boolean;
  error: string | null;
  aspectHint?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}{aspectHint ? ` ${aspectHint}` : ""} Max {maxSizeMb} MB.</p>
      </div>
      <div className="flex items-start gap-3">
        {currentUrl ? (
          <div className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted overflow-hidden" style={aspectHint ? { width: 80, height: 45 } : { width: 48, height: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt={label} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div
            className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground"
            style={aspectHint ? { width: 80, height: 45 } : { width: 48, height: 48 }}
          >
            <Upload className="h-4 w-4" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
            <label
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted${uploading ? " pointer-events-none opacity-50" : ""}`}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? tc("uploading") : currentUrl ? tc("replace") : tc("upload")}
            </label>
            {currentUrl && (
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-opacity hover:opacity-80"
              >
                <X className="h-3.5 w-3.5" />
                {tc("remove")}
              </button>
            )}
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function CallbackUrl({ appUrl, provider }: { appUrl: string; provider: string }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const url = appUrl ? `${appUrl}/api/auth/callback/${provider}` : null;

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-xs font-medium text-foreground">{t("callbackUrlLabel")}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground truncate select-all">
          {url ?? <span className="italic">{t("callbackSetAppUrl")}</span>}
        </div>
        {url && (
          <button
            type="button"
            onClick={copy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {copied ? <><Check className="h-3 w-3" /> {tc("copied")}</> : <><Copy className="h-3 w-3" /> {tc("copy")}</>}
          </button>
        )}
      </div>
    </div>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.02.015.04.03.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const TABS = ["branding", "seo", "auth", "email"] as const;
type Tab = (typeof TABS)[number];

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  const [tab, setTab] = useState<Tab>("branding");
  const [needsRestart, setNeedsRestart] = useState(false);
  const [githubExpanded, setGithubExpanded] = useState(false);
  const [discordExpanded, setDiscordExpanded] = useState(false);

  const { data, isLoading } = useQuery(orpc.settings.getConfig.queryOptions());
  const setMutation = useMutation(orpc.settings.set.mutationOptions({ onSuccess: invalidateSettings }));
  const removeLogoMutation = useMutation(orpc.settings.removeLogo.mutationOptions({ onSuccess: invalidateSettings }));
  const removeOgBannerMutation = useMutation(orpc.settings.removeOgBanner.mutationOptions({ onSuccess: invalidateSettings }));

  const [saved, setSaved] = useState<SavedKey[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [general, setGeneral] = useState<{ appName: string; appUrl: string } | null>(null);
  const [seo, setSeo] = useState<{
    metaDescription: string; metaKeywords: string; themeColor: string;
    ogTitle: string; ogDescription: string; ogSiteName: string; ogType: string;
    twitterCard: string; twitterSite: string; twitterCreator: string;
  } | null>(null);
  const [seoPreviewTab, setSeoPreviewTab] = useState<"discord" | "google" | "twitter">("discord");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<{ enabled: boolean } | null>(null);
  const [github, setGithub] = useState<{ enabled: boolean; clientId: string; clientSecret: string }>({ enabled: false, clientId: "", clientSecret: "" });
  const [discord, setDiscord] = useState<{ enabled: boolean; clientId: string; clientSecret: string }>({ enabled: false, clientId: "", clientSecret: "" });

  // Email / SMTP state
  const { data: smtpData, isLoading: smtpLoading } = useQuery(orpc.email.getSmtpConfig.queryOptions());
  const saveSmtpMutation = useMutation(orpc.email.saveSmtpConfig.mutationOptions());
  const testConnectionMutation = useMutation(orpc.email.testConnection.mutationOptions());
  const [smtp, setSmtp] = useState<{
    enabled: boolean; host: string; port: string; user: string; password: string;
    fromEmail: string; fromName: string; secure: boolean;
  } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setGithub((prev) => prev.clientId || prev.enabled ? prev : { enabled: data.githubEnabled, clientId: data.githubClientId, clientSecret: "" });
    setDiscord((prev) => prev.clientId || prev.enabled ? prev : { enabled: data.discordEnabled, clientId: data.discordClientId, clientSecret: "" });
  }, [data]);

  useEffect(() => {
    if (!smtpData || smtp !== null) return;
    setSmtp({
      enabled: smtpData.enabled,
      host: smtpData.host,
      port: smtpData.port,
      user: smtpData.user,
      password: "",
      fromEmail: smtpData.fromEmail,
      fromName: smtpData.fromName,
      secure: smtpData.secure,
    });
  }, [smtpData, smtp]);

  function markSaved(key: string) {
    setSaved((s) => [...s, key]);
    setTimeout(() => setSaved((s) => s.filter((k) => k !== key)), 2000);
  }

  function generalForm() {
    return general ?? { appName: data?.appName ?? "Struxa", appUrl: data?.appUrl ?? "" };
  }
  function seoForm() {
    return seo ?? {
      metaDescription: data?.metaDescription ?? "",
      metaKeywords: data?.metaKeywords ?? "",
      themeColor: data?.themeColor ?? "",
      ogTitle: data?.ogTitle ?? "",
      ogDescription: data?.ogDescription ?? "",
      ogSiteName: data?.ogSiteName ?? "",
      ogType: data?.ogType ?? "website",
      twitterCard: data?.twitterCard ?? "summary_large_image",
      twitterSite: data?.twitterSite ?? "",
      twitterCreator: data?.twitterCreator ?? "",
    };
  }
  function registrationForm() {
    return registration ?? { enabled: data?.registrationEnabled ?? true };
  }

  async function saveGeneral() {
    const f = generalForm();
    const saves: Promise<unknown>[] = [];
    if (!data?.appNameFromEnv) saves.push(setMutation.mutateAsync({ key: "app_name", value: f.appName }));
    if (!data?.appUrlFromEnv) saves.push(setMutation.mutateAsync({ key: "app_url", value: f.appUrl }));
    await Promise.all(saves);
    if (!data?.appNameFromEnv) setNeedsRestart(true);
    markSaved("general");
  }

  async function saveSeo() {
    const f = seoForm();
    await Promise.all([
      setMutation.mutateAsync({ key: "meta_description", value: f.metaDescription }),
      setMutation.mutateAsync({ key: "meta_keywords", value: f.metaKeywords }),
      setMutation.mutateAsync({ key: "theme_color", value: f.themeColor }),
      setMutation.mutateAsync({ key: "og_title", value: f.ogTitle }),
      setMutation.mutateAsync({ key: "og_description", value: f.ogDescription }),
      setMutation.mutateAsync({ key: "og_site_name", value: f.ogSiteName }),
      setMutation.mutateAsync({ key: "og_type", value: f.ogType }),
      setMutation.mutateAsync({ key: "twitter_card", value: f.twitterCard }),
      setMutation.mutateAsync({ key: "twitter_site", value: f.twitterSite }),
      setMutation.mutateAsync({ key: "twitter_creator", value: f.twitterCreator }),
    ]);
    markSaved("seo");
  }

  async function saveRegistration() {
    await setMutation.mutateAsync({ key: "registration_enabled", value: String(registrationForm().enabled) });
    markSaved("registration");
  }

  async function saveGithub() {
    const saves: Promise<unknown>[] = [
      setMutation.mutateAsync({ key: "github_enabled", value: String(github.enabled) }),
      setMutation.mutateAsync({ key: "github_client_id", value: github.clientId }),
    ];
    if (github.clientSecret) saves.push(setMutation.mutateAsync({ key: "github_client_secret", value: github.clientSecret }));
    await Promise.all(saves);
    setGithub((prev) => ({ ...prev, clientSecret: "" }));
    setNeedsRestart(true);
    markSaved("github");
  }

  async function saveDiscord() {
    const saves: Promise<unknown>[] = [
      setMutation.mutateAsync({ key: "discord_enabled", value: String(discord.enabled) }),
      setMutation.mutateAsync({ key: "discord_client_id", value: discord.clientId }),
    ];
    if (discord.clientSecret) saves.push(setMutation.mutateAsync({ key: "discord_client_secret", value: discord.clientSecret }));
    await Promise.all(saves);
    setDiscord((prev) => ({ ...prev, clientSecret: "" }));
    setNeedsRestart(true);
    markSaved("discord");
  }

  async function saveSmtp() {
    if (!smtp) return;
    await saveSmtpMutation.mutateAsync({
      enabled: smtp.enabled,
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      password: smtp.password,
      fromEmail: smtp.fromEmail,
      fromName: smtp.fromName,
      secure: smtp.secure,
    });
    setSmtp((prev) => prev ? { ...prev, password: "" } : null);
    markSaved("smtp");
  }

  async function testSmtp(email: string) {
    setTestResult(null);
    const result = await testConnectionMutation.mutateAsync({ email });
    setTestModalOpen(false);
    if (result.ok) {
      setTestResult({ ok: true, message: t("testConnectionSuccess", { email: result.email }) });
    } else {
      setTestResult({ ok: false, message: t("testConnectionFailed", { error: result.error ?? "Unknown error" }) });
    }
  }

  async function handleUpload(
    endpoint: string,
    setUploading: (v: boolean) => void,
    setError: (v: string | null) => void,
    file: File,
  ) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Upload failed.");
      } else {
        invalidateSettings();
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const gf = generalForm();
  const rf = registrationForm();
  const bothFromEnv = data?.appNameFromEnv && data?.appUrlFromEnv;

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className={`mx-auto flex flex-col gap-4 ${tab === "seo" ? "max-w-5xl" : "max-w-2xl"}`}>
        <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border -mb-1">
          {TABS.map((tab_item) => (
            <button
              key={tab_item}
              type="button"
              onClick={() => setTab(tab_item)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === tab_item
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab_item === "branding" ? t("tabBranding")
                : tab_item === "seo" ? t("tabSeo")
                : tab_item === "auth" ? t("tabAuth")
                : t("tabEmail")}
            </button>
          ))}
        </div>

        {/* Restart banner */}
        {needsRestart && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{t("restartRequired")}</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                {t("restartDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNeedsRestart(false)}
              className="text-amber-500 hover:text-amber-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }} className="flex flex-col gap-4">
        {tab === "branding" && (
          <>
            <SectionCard title={t("generalTitle")} description={t("generalDesc")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("appNameLabel")}</label>
                  <input
                    className={inputClass(data?.appNameFromEnv)}
                    value={gf.appName}
                    disabled={data?.appNameFromEnv}
                    onChange={(e) => setGeneral({ ...gf, appName: e.target.value })}
                  />
                  {data?.appNameFromEnv && <p className="text-[11px] text-muted-foreground">{t("appNameEnvNote")}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("appUrlLabel")}</label>
                  <input
                    className={inputClass(data?.appUrlFromEnv)}
                    placeholder={t("appUrlPlaceholder")}
                    value={gf.appUrl}
                    disabled={data?.appUrlFromEnv}
                    onChange={(e) => setGeneral({ ...gf, appUrl: e.target.value })}
                  />
                  {data?.appUrlFromEnv && <p className="text-[11px] text-muted-foreground">{t("appUrlEnvNote")}</p>}
                </div>
              </div>
              {!bothFromEnv && (
                <div className="mt-4" onClick={saveGeneral}>
                  <SaveButton saving={setMutation.isPending} saved={saved.includes("general")} />
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("logoTitle")} description={t("logoDesc")}>
              <ImageUploadField
                label={t("logoLabel")}
                description={t("logoHint")}
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                maxSizeMb={5}
                currentUrl={data?.logoUrl}
                uploading={logoUploading}
                error={logoError}
                onUpload={(f) => handleUpload("/api/files/upload/logo", setLogoUploading, setLogoError, f)}
                onRemove={() => removeLogoMutation.mutate(undefined)}
              />
            </SectionCard>
          </>
        )}

        {tab === "seo" && (() => {
          const sf = seoForm();
          const previewData: SeoPreviewData = {
            title: sf.ogTitle || data?.appName || "Struxa",
            description: sf.ogDescription || sf.metaDescription || `${data?.appName || "Struxa"} panel`,
            siteName: sf.ogSiteName || data?.appName || "Struxa",
            siteUrl: data?.appUrl || "",
            imageUrl: data?.ogBannerUrl ?? null,
            themeColor: sf.themeColor,
            twitterCard: (sf.twitterCard as "summary" | "summary_large_image") || "summary_large_image",
            twitterSite: sf.twitterSite,
          };
          return (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
              {/* Left: form sections */}
              <div className="flex flex-col gap-4">
                <SectionCard title={t("seoBasicTitle")} description={t("seoBasicDesc")}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("metaDescLabel")}</label>
                      <textarea
                        rows={2}
                        className={`${inputClass()} resize-none`}
                        placeholder={t("metaDescPlaceholder")}
                        value={sf.metaDescription}
                        onChange={(e) => setSeo({ ...sf, metaDescription: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("seoKeywordsLabel")}</label>
                      <input
                        className={inputClass()}
                        placeholder={t("seoKeywordsPlaceholder")}
                        value={sf.metaKeywords}
                        onChange={(e) => setSeo({ ...sf, metaKeywords: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">{t("seoKeywordsHint")}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("seoThemeColorLabel")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                          value={sf.themeColor || "#5865F2"}
                          onChange={(e) => setSeo({ ...sf, themeColor: e.target.value })}
                        />
                        <input
                          className={`${inputClass()} flex-1`}
                          placeholder={t("seoThemeColorPlaceholder")}
                          value={sf.themeColor}
                          onChange={(e) => setSeo({ ...sf, themeColor: e.target.value })}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t("seoThemeColorHint")}</p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title={t("seoOgSectionTitle")} description={t("seoOgSectionDesc")}>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{t("seoOgTitleLabel")}</label>
                        <input
                          className={inputClass()}
                          placeholder={t("seoOgTitlePlaceholder")}
                          value={sf.ogTitle}
                          onChange={(e) => setSeo({ ...sf, ogTitle: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{t("seoOgSiteNameLabel")}</label>
                        <input
                          className={inputClass()}
                          placeholder={t("seoOgSiteNamePlaceholder")}
                          value={sf.ogSiteName}
                          onChange={(e) => setSeo({ ...sf, ogSiteName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("seoOgDescLabel")}</label>
                      <textarea
                        rows={2}
                        className={`${inputClass()} resize-none`}
                        placeholder={t("seoOgDescPlaceholder")}
                        value={sf.ogDescription}
                        onChange={(e) => setSeo({ ...sf, ogDescription: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("seoOgTypeLabel")}</label>
                      <Select value={sf.ogType || "website"} onValueChange={(v) => setSeo({ ...sf, ogType: v ?? "website" })}>
                        <SelectTrigger className="h-[30px] text-sm">
                          <SelectValue>
                            {sf.ogType === "article" ? t("seoOgTypeArticle") : sf.ogType === "profile" ? t("seoOgTypeProfile") : t("seoOgTypeWebsite")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">{t("seoOgTypeWebsite")}</SelectItem>
                          <SelectItem value="article">{t("seoOgTypeArticle")}</SelectItem>
                          <SelectItem value="profile">{t("seoOgTypeProfile")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-1">
                      <ImageUploadField
                        label={t("seoOgImageTitle")}
                        description={t("seoOgImageDesc")}
                        accept="image/jpeg,image/png,image/webp"
                        maxSizeMb={8}
                        aspectHint={t("bannerAspectHint")}
                        currentUrl={data?.ogBannerUrl}
                        uploading={bannerUploading}
                        error={bannerError}
                        onUpload={(f) => handleUpload("/api/files/upload/og-banner", setBannerUploading, setBannerError, f)}
                        onRemove={() => removeOgBannerMutation.mutate(undefined)}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title={t("seoTwitterSectionTitle")} description={t("seoTwitterSectionDesc")}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("seoTwitterCardLabel")}</label>
                      <Select value={sf.twitterCard || "summary_large_image"} onValueChange={(v) => setSeo({ ...sf, twitterCard: v ?? "summary_large_image" })}>
                        <SelectTrigger className="h-[30px] text-sm">
                          <SelectValue>
                            {sf.twitterCard === "summary" ? t("seoTwitterCardSummary") : t("seoTwitterCardLarge")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary_large_image">{t("seoTwitterCardLarge")}</SelectItem>
                          <SelectItem value="summary">{t("seoTwitterCardSummary")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{t("seoTwitterSiteLabel")}</label>
                        <input
                          className={inputClass()}
                          placeholder={t("seoTwitterSitePlaceholder")}
                          value={sf.twitterSite}
                          onChange={(e) => setSeo({ ...sf, twitterSite: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{t("seoTwitterCreatorLabel")}</label>
                        <input
                          className={inputClass()}
                          placeholder={t("seoTwitterCreatorPlaceholder")}
                          value={sf.twitterCreator}
                          onChange={(e) => setSeo({ ...sf, twitterCreator: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <div onClick={saveSeo}>
                  <SaveButton saving={setMutation.isPending} saved={saved.includes("seo")} />
                </div>
              </div>

              {/* Right: live preview */}
              <div className="lg:sticky lg:top-4 flex flex-col gap-3">
                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">{t("seoPreviewTitle")}</h2>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex gap-1">
                      {(["discord", "google", "twitter"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSeoPreviewTab(p)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            seoPreviewTab === p
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {p === "discord" ? t("seoPreviewDiscord") : p === "google" ? t("seoPreviewGoogle") : t("seoPreviewTwitter")}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1">
                      {seoPreviewTab === "discord" && <DiscordPreview data={previewData} />}
                      {seoPreviewTab === "google" && <GooglePreview data={previewData} />}
                      {seoPreviewTab === "twitter" && <TwitterPreview data={previewData} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {tab === "auth" && (
          <>
            <SectionCard title={t("registrationTitle")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("allowRegistrationLabel")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("allowRegistrationDesc")}</p>
                </div>
                <Toggle enabled={rf.enabled} onChange={(v) => setRegistration({ enabled: v })} />
              </div>
              <div className="mt-4" onClick={saveRegistration}>
                <SaveButton saving={setMutation.isPending} saved={saved.includes("registration")} />
              </div>
            </SectionCard>

            <SectionCard title={t("socialLoginTitle")} description={t("socialLoginDesc")}>
              <div className="flex flex-col gap-2">
                {/* GitHub */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGithubExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Github className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-medium text-foreground">GitHub</span>
                      {(data?.githubEnabled || github.enabled) && (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">{t("enabled")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={github.enabled} onChange={(v) => setGithub({ ...github, enabled: v })} />
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${githubExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {githubExpanded && (
                    <div className="border-t border-border px-4 py-4">
                      <CallbackUrl appUrl={data?.appUrl ?? ""} provider="github" />
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("clientIdLabel")}</label>
                          <input
                            className={inputClass()}
                            placeholder="Iv1.xxxxxxxxxxxx"
                            value={github.clientId}
                            onChange={(e) => setGithub({ ...github, clientId: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("clientSecretLabel")}</label>
                          <input
                            className={inputClass()}
                            type="password"
                            placeholder={data?.githubClientSecretSet ? t("clientSecretSet") : t("enterSecret")}
                            value={github.clientSecret}
                            onChange={(e) => setGithub({ ...github, clientSecret: e.target.value })}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div onClick={saveGithub}>
                        <SaveButton saving={setMutation.isPending} saved={saved.includes("github")} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Discord */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiscordExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <DiscordIcon className="h-4 w-4 text-[#5865F2]" />
                      <span className="text-sm font-medium text-foreground">Discord</span>
                      {(data?.discordEnabled || discord.enabled) && (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">{t("enabled")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={discord.enabled} onChange={(v) => setDiscord({ ...discord, enabled: v })} />
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${discordExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {discordExpanded && (
                    <div className="border-t border-border px-4 py-4">
                      <CallbackUrl appUrl={data?.appUrl ?? ""} provider="discord" />
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("clientIdLabel")}</label>
                          <input
                            className={inputClass()}
                            placeholder="000000000000000000"
                            value={discord.clientId}
                            onChange={(e) => setDiscord({ ...discord, clientId: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("clientSecretLabel")}</label>
                          <input
                            className={inputClass()}
                            type="password"
                            placeholder={data?.discordClientSecretSet ? t("clientSecretSet") : t("enterSecret")}
                            value={discord.clientSecret}
                            onChange={(e) => setDiscord({ ...discord, clientSecret: e.target.value })}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div onClick={saveDiscord}>
                        <SaveButton saving={setMutation.isPending} saved={saved.includes("discord")} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {tab === "email" && (
          <>
            <SectionCard title={t("smtpTitle")} description={t("smtpDesc")}>
              {smtpLoading || !smtp ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("smtpEnabled")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("smtpEnabledDesc")}</p>
                    </div>
                    <Toggle enabled={smtp.enabled} onChange={(v) => setSmtp({ ...smtp, enabled: v })} />
                  </div>

                  {smtp.enabled && (
                    <>
                      {/* Host + Port */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpHost")}</label>
                          <input
                            className={inputClass()}
                            placeholder="smtp.example.com"
                            value={smtp.host}
                            onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpPort")}</label>
                          <input
                            className={inputClass()}
                            placeholder="587"
                            value={smtp.port}
                            onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* User + Password */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpUser")}</label>
                          <input
                            className={inputClass()}
                            placeholder="user@example.com"
                            value={smtp.user}
                            onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpPassword")}</label>
                          <input
                            className={inputClass()}
                            type="password"
                            placeholder={smtpData?.passwordSet ? t("smtpPasswordSet") : ""}
                            value={smtp.password}
                            onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      {/* From Email + From Name */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpFromEmail")}</label>
                          <input
                            className={inputClass()}
                            placeholder="noreply@example.com"
                            value={smtp.fromEmail}
                            onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-foreground">{t("smtpFromName")}</label>
                          <input
                            className={inputClass()}
                            placeholder="Struxa"
                            value={smtp.fromName}
                            onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* TLS toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{t("smtpSecure")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("smtpSecureDesc")}</p>
                        </div>
                        <Toggle enabled={smtp.secure} onChange={(v) => setSmtp({ ...smtp, secure: v })} />
                      </div>
                    </>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div onClick={saveSmtp}>
                      <SaveButton saving={saveSmtpMutation.isPending} saved={saved.includes("smtp")} />
                    </div>
                    {smtp.enabled && (
                      <button
                        type="button"
                        onClick={() => { setTestEmail(""); setTestResult(null); setTestModalOpen(true); }}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Mail className="h-3.5 w-3.5" /> {t("testConnection")}
                      </button>
                    )}
                  </div>

                  {testResult && (
                    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${testResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
                      {testResult.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t("templatesTitle")} description={t("templatesDesc")}>
              <Link
                href="/admin/settings/email"
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted group"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("editTemplates")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("editTemplatesDesc")}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            </SectionCard>
          </>
        )}
        </motion.div>
      </div>

      {/* Test connection modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTestModalOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t("testConnectionModalTitle")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("testConnectionModalDesc")}</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void testSmtp(testEmail); }}>
              <input
                type="email"
                autoFocus
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={t("testConnectionEmailPlaceholder")}
                className={inputClass()}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t("testConnectionCancel")}
                </button>
                <button
                  type="submit"
                  disabled={!testEmail || testConnectionMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {testConnectionMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("testConnectionTesting")}</>
                  ) : (
                    <><Mail className="h-3.5 w-3.5" /> {t("testConnectionSend")}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
