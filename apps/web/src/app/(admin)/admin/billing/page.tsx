"use client";

import React, { useState, useEffect, useId, useMemo } from "react";
import { useMediaQuery } from "@struxa/ui/hooks/use-media-query";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { orpc, queryClient } from "@/utils/orpc";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  CreditCard,
  Building2,
  Layers,
  Tag,
  Settings2,
  Users,
  Upload,
  X,
  ImageIcon,
  Check,
  Copy,
  Archive,
  Network,
  Database,
  Star,
  EyeOff,
  CircleOff,

  Cpu,
  MemoryStick,
  HardDrive,


} from "lucide-react";
import { cn } from "@struxa/ui/lib/utils";
import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";
import { Switch } from "@struxa/ui/components/switch";
import { SearchSelect } from "@struxa/ui/components/search-select";
import { GroupedMultiSelect } from "@struxa/ui/components/grouped-multi-select";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@struxa/ui/components/tabs";
import { Badge } from "@struxa/ui/components/badge";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@struxa/ui/components/tooltip";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@struxa/ui/components/card";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetPanel,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@struxa/ui/components/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@struxa/ui/components/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderType = "stripe" | "simpay" | "paypal" | "przelewy24";

interface Gateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  sortOrder: number;
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  sandbox: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  icon: string;
  bannerUrl: string;
}

interface ResourceLimits {
  cpu: number;
  ram: number;
  disk: number;
  backups: number;
  allocations: number;
  databases: number;
  eggs: string[];
  nodes: string[];
}

type Duration = "7day" | "1month" | "3months" | "6months" | "1year";

interface PlanPrice {
  id: string;
  duration: Duration;
  price: number;
}

interface Plan {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  isActive: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  icon: string;
  resources: ResourceLimits;
  prices: PlanPrice[];
}



const DURATIONS: Duration[] = ["7day", "1month", "3months", "6months", "1year"];

const _cn = new Intl.DisplayNames(["en"], { type: "currency" });
const CURRENCIES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD",
  "CAD","CDF","CHF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD",
  "GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KRW","KWD","KYD","KZT","LAK",
  "LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD",
  "OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SOS","SRD","STN","SYP","SZL",
  "THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","UYU","UZS","VES","VND","VUV","WST","XAF","XCD","XOF","XPF","YER","ZAR","ZMW","ZWL",
].map((c) => ({ value: c, label: _cn.of(c) ?? c }));


// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function formatPrice(price: number) {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProviderLogo({ provider, size = "md" }: { provider: ProviderType; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-5 w-5 rounded-md" : "h-7 w-7 rounded-lg";
  const iconMd = size === "sm" ? "size-3" : "size-4";
  if (provider === "stripe" || provider === "simpay" || provider === "paypal" || provider === "przelewy24") {
    return (
      <img
        src={`/providers/${provider}-icon.png`}
        alt={provider}
        className={cn("shrink-0 object-contain", box)}
      />
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center border border-border bg-muted", box)}>
      <Building2 className={cn("text-muted-foreground", iconMd)} />
    </div>
  );
}

function WebhookEndpointInfo({ provider }: { provider: string }) {
  const t = useTranslations("admin.billing.providers");
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/api/billing/webhook/${provider}`
    : `/api/billing/webhook/${provider}`;

  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">{t("webhookEndpointLabel")}</Label>
      <p className="text-[11px] text-muted-foreground">{t("webhookEndpointHint")}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">{url}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-blue-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── SettingRow ───────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-normal text-foreground"
        >
          {label}
        </Label>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Category preview card (click-to-upload banner + icon) ───────────────────

function CategoryPreviewCard({
  name,
  description,
  iconUrl,
  bannerUrl,
  iconUploading,
  bannerUploading,
  iconError,
  bannerError,
  onIconUpload,
  onBannerUpload,
  onIconRemove,
  onBannerRemove,
}: {
  name: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  iconUploading: boolean;
  bannerUploading: boolean;
  iconError: string | null;
  bannerError: string | null;
  onIconUpload: (f: File) => void;
  onBannerUpload: (f: File) => void;
  onIconRemove: () => void;
  onBannerRemove: () => void;
}) {
  const t = useTranslations("admin.billing.catalog.categories");
  const iconRef = React.useRef<HTMLInputElement>(null);
  const bannerRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">{t("preview")}</Label>

      <input ref={iconRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onIconUpload(f); if (iconRef.current) iconRef.current.value = ""; }} />
      <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerUpload(f); if (bannerRef.current) bannerRef.current.value = ""; }} />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="group relative h-28 cursor-pointer"
          onClick={() => bannerRef.current?.click()}
        >
          {bannerUrl
            ? <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-gradient-to-br from-muted to-muted/60" />
          }
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {bannerUploading ? t("uploading") : bannerUrl ? <><ImageIcon className="size-3.5" /> {t("changeBanner")}</> : <><Upload className="size-3.5" /> {t("uploadBanner")}</>}
            </div>
          </div>
          {bannerUrl && !bannerUploading && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBannerRemove(); }}
              className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
            >
              <X className="size-3" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        </div>

        <div className="relative -mt-7 flex items-end gap-3 px-4 pb-4">
          <div
            className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-card bg-muted"
            onClick={() => iconRef.current?.click()}
          >
            {iconUrl
              ? <img src={iconUrl} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center"><Layers className="size-5 text-muted-foreground/60" /></div>
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
              {iconUploading
                ? <span className="text-[10px] font-medium text-white">{t("iconUploading")}</span>
                : <Upload className="size-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              }
            </div>
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>

      {(iconError || bannerError) && (
        <div className="flex flex-col gap-0.5">
          {iconError && <p className="text-[11px] text-destructive">Icon: {iconError}</p>}
          {bannerError && <p className="text-[11px] text-destructive">Banner: {bannerError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Plan preview card ────────────────────────────────────────────────────────

function PlanPreviewCard({
  name,
  description,
  planIconUrl,
  categoryIconUrl,
  categoryName,
  resources,
  prices,
  iconUploading,
  iconError,
  onIconUpload,
  onIconRemove,
}: {
  name: string;
  description: string;
  planIconUrl: string;
  categoryIconUrl: string;
  categoryName: string;
  resources: ResourceLimits;
  prices: PlanPrice[];
  iconUploading: boolean;
  iconError: string | null;
  onIconUpload: (f: File) => void;
  onIconRemove: () => void;
}) {
  const iconRef = React.useRef<HTMLInputElement>(null);
  const displayIcon = planIconUrl || categoryIconUrl;

  const lowestPrice = prices.length > 0
    ? prices.reduce((a, b) => a.price < b.price ? a : b)
    : null;

  const ts = useTranslations("panel.billing.specs");
  const tp = useTranslations("admin.billing.catalog.plans");
  const specs = [
    { icon: <Cpu className="size-3.5 shrink-0" />, value: resources.cpu, unit: ts("cpu") },
    { icon: <MemoryStick className="size-3.5 shrink-0" />, value: resources.ram, unit: ts("ram") },
    { icon: <HardDrive className="size-3.5 shrink-0" />, value: resources.disk, unit: ts("disk") },
    { icon: <Archive className="size-3.5 shrink-0" />, value: resources.backups, unit: ts("backups") },
    { icon: <Network className="size-3.5 shrink-0" />, value: resources.allocations, unit: ts("allocations") },
    { icon: <Database className="size-3.5 shrink-0" />, value: resources.databases, unit: ts("databases") },
  ];

  const durationShort: Record<Duration, string> = {
    "7day": tp("durationShort.7day"), "1month": tp("durationShort.1month"), "3months": tp("durationShort.3months"), "6months": tp("durationShort.6months"), "1year": tp("durationShort.1year"),
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <input
        ref={iconRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onIconUpload(f); if (iconRef.current) iconRef.current.value = ""; }}
      />
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="group relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
          onClick={() => iconRef.current?.click()}
        >
          {displayIcon
            ? <img src={displayIcon} alt="" className="h-full w-full object-cover" />
            : <Tag className="size-4 text-muted-foreground/60" />
          }
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
            {iconUploading
              ? <span className="text-[10px] font-medium text-white">…</span>
              : <Upload className="size-3 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            }
          </div>
          {planIconUrl && !iconUploading && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onIconRemove(); }}
              className="absolute -right-1 -top-1 hidden items-center justify-center rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:flex"
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{categoryName}</p>
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        </div>
      </div>
      {iconError && <p className="px-4 pb-2 text-[11px] text-destructive">{iconError}</p>}

      {description && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">{description}</p>
      )}

      <div className="border-t border-border/60 px-4 py-3 flex flex-col gap-2">
        {specs.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="text-foreground/60">{s.icon}</span>
            <span><span className="font-semibold text-foreground">{s.value}</span> {s.unit}</span>
          </div>
        ))}
      </div>

      {lowestPrice && (
        <div className="border-t border-border/60 px-4 py-3">
          <p className="text-lg font-bold text-foreground">
            {formatPrice(lowestPrice.price)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ {durationShort[lowestPrice.duration]}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

type SettingSection = "general" | "referral";

function invalidateBillingConfig() {
  void queryClient.invalidateQueries({ queryKey: orpc.settings.getBillingConfig.key() });
}

function SettingsTab() {
  const t = useTranslations("admin.billing.settings");
  const tc = useTranslations("common");

  const [activeSection, setActiveSection] = useState<SettingSection>("general");

  const { data, isLoading } = useQuery(orpc.settings.getBillingConfig.queryOptions());
  const saveMutation = useMutation(
    orpc.settings.setBillingSettings.mutationOptions({
      onSuccess: () => {
        toast.success(tc("saved"));
        invalidateBillingConfig();
      },
      onError: () => {
        if (data) {
          setGeneral({ enabled: data.enabled, currency: data.defaultCurrency });
          setReferral({ enabled: data.referralEnabled, refereeDiscount: data.refereeDiscountPercent, referrerReward: data.referrerRewardPercent });
        }
      },
    }),
  );

  const [general, setGeneral] = useState<{ enabled: boolean; currency: string } | null>(null);
  const [referral, setReferral] = useState<{ enabled: boolean; refereeDiscount: number; referrerReward: number } | null>(null);

  useEffect(() => {
    if (!data) return;
    setGeneral((p) => p ?? { enabled: data.enabled, currency: data.defaultCurrency });
    setReferral((p) => p ?? { enabled: data.referralEnabled, refereeDiscount: data.refereeDiscountPercent, referrerReward: data.referrerRewardPercent });
  }, [data]);

  const saveGeneral = useDebouncedCallback(
    (v: typeof general) => {
      if (!v) return;
      saveMutation.mutate({ enabled: v.enabled, defaultCurrency: v.currency });
    },
    { wait: 600 },
  );
  const saveReferral = useDebouncedCallback(
    (v: typeof referral) => {
      if (!v) return;
      saveMutation.mutate({ referralEnabled: v.enabled, refereeDiscountPercent: v.refereeDiscount, referrerRewardPercent: v.referrerReward });
    },
    { wait: 600 },
  );

  const sections: {
    id: SettingSection;
    label: string;
    icon: typeof Settings2;
  }[] = [
    { id: "general", label: t("general.title"), icon: Settings2 },
    { id: "referral", label: t("referral.title"), icon: Users },
  ];

  const g = general ?? { enabled: true, currency: "USD" };
  const ref = referral ?? { enabled: false, refereeDiscount: 0, referrerReward: 0 };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
      {/* Mobile: dropdown picker */}
      <div className="sm:hidden">
        <Select
          value={activeSection}
          onValueChange={(v) => { if (v) setActiveSection(v as SettingSection); }}
        >
          <SelectTrigger>
            <SelectValue>
              {(v: string) => sections.find((s) => s.id === v)?.label ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: sidebar nav */}
      <nav className="hidden w-44 shrink-0 sm:block">
        <div className="flex flex-col gap-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                activeSection === s.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <s.icon className="size-3.5 shrink-0" />
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <motion.div
        key={activeSection}
        className="min-w-0 flex-1"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="divide-y divide-border px-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-9 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {activeSection === "general" && (
              <Card className="gap-0 py-0">
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-sm font-semibold">
                    {t("general.title")}
                  </CardTitle>
                  <CardDescription>{t("general.description")}</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border px-4 py-0">
                  <SettingRow label={t("general.enableBilling")}>
                    <Switch
                      checked={g.enabled}
                      onCheckedChange={(v) => {
                        const next = { ...(general ?? g), enabled: v };
                        setGeneral(next);
                        saveGeneral(next);
                      }}
                    />
                  </SettingRow>
                  <SettingRow label={t("general.defaultCurrency")}>
                    <SearchSelect
                      value={g.currency}
                      onValueChange={(v) => {
                        if (!v) return;
                        const next = { ...(general ?? g), currency: v };
                        setGeneral(next);
                        saveGeneral(next);
                      }}
                      items={CURRENCIES}
                      searchPlaceholder={t("general.searchCurrencies")}
                      noResultsText={t("general.noResults")}
                      className="w-28"
                    />
                  </SettingRow>
                </CardContent>
              </Card>
            )}

            {activeSection === "referral" && (
              <Card className="gap-0 py-0">
                <CardHeader className="border-b border-border px-4 py-3">
                  <CardTitle className="text-sm font-semibold">
                    {t("referral.title")}
                  </CardTitle>
                  <CardDescription>{t("referral.description")}</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border px-4 py-0">
                  <SettingRow label={t("referral.enableReferral")}>
                    <Switch
                      checked={ref.enabled}
                      onCheckedChange={(v) => {
                        const next = { ...(referral ?? ref), enabled: v };
                        setReferral(next);
                        saveReferral(next);
                      }}
                    />
                  </SettingRow>
                  <SettingRow label={t("referral.refereeDiscount")} description={t("referral.refereeDiscountDesc")}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={ref.refereeDiscount}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        const next = { ...(referral ?? ref), refereeDiscount: Math.max(0, Math.min(100, Math.round(raw))) };
                        setReferral(next);
                        saveReferral(next);
                      }}
                      className="w-20"
                    />
                  </SettingRow>
                  <SettingRow label={t("referral.referrerReward")} description={t("referral.referrerRewardDesc")}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={ref.referrerReward}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        const next = { ...(referral ?? ref), referrerReward: Math.max(0, Math.min(100, Math.round(raw))) };
                        setReferral(next);
                        saveReferral(next);
                      }}
                      className="w-20"
                    />
                  </SettingRow>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── Providers tab ────────────────────────────────────────────────────────────

type GatewayDialogState =
  | null
  | { type: "add" }
  | { type: "edit"; gateway: Gateway }
  | { type: "delete"; gateway: Gateway };

function ProvidersTab() {
  const t = useTranslations("admin.billing.providers");
  const tc = useTranslations("common");
  const isMobile = useMediaQuery("max-sm");

  const { data: gateways = [] } = useQuery(orpc.billing.adminListGateways.queryOptions());
  const createMutation = useMutation(orpc.billing.adminCreateGateway.mutationOptions({ onSuccess: invalidateGateways }));
  const updateMutation = useMutation(orpc.billing.adminUpdateGateway.mutationOptions({ onSuccess: invalidateGateways }));
  const deleteMutation = useMutation(orpc.billing.adminDeleteGateway.mutationOptions({ onSuccess: invalidateGateways }));

  function invalidateGateways() {
    void queryClient.invalidateQueries({ queryKey: orpc.billing.adminListGateways.key() });
  }

  const [dialog, setDialog] = useState<GatewayDialogState>(null);
  const [form, setForm] = useState({
    provider: "stripe" as string,
    isActive: true,
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    serviceId: "",
    sandbox: false,
  });

  const activeId = useId();

  const ALL_PROVIDERS: ProviderType[] = ["stripe", "simpay", "paypal", "przelewy24"];

  const providerLabels: Record<string, string> = {
    stripe: t("stripe"),
    simpay: t("simpay"),
    paypal: t("paypal"),
    przelewy24: t("przelewy24"),
  };

  const configuredProviders = new Set(gateways.map((g) => g.provider));
  const availableProviders = ALL_PROVIDERS.filter((p) => !configuredProviders.has(p));

  function openAdd() {
    const defaultProvider = availableProviders[0] ?? "stripe";
    setForm({ provider: defaultProvider, isActive: true, publishableKey: "", secretKey: "", webhookSecret: "", serviceId: "", sandbox: false });
    setDialog({ type: "add" });
  }

  function openEdit(g: Gateway) {
    setForm({ provider: g.provider, isActive: g.isActive, publishableKey: "", secretKey: "", webhookSecret: "", serviceId: "", sandbox: g.sandbox });
    setDialog({ type: "edit", gateway: g });
  }

  function saveGateway() {
    if (dialog?.type === "add") {
      createMutation.mutate({
        name: providerLabels[form.provider] ?? form.provider,
        provider: form.provider,
        isActive: form.isActive,
        publishableKey: form.publishableKey || undefined,
        secretKey: form.secretKey || undefined,
        webhookSecret: form.webhookSecret || undefined,
        serviceId: form.serviceId || undefined,
        sandbox: form.sandbox,
      }, { onSuccess: () => setDialog(null) });
    } else if (dialog?.type === "edit") {
      updateMutation.mutate({
        id: dialog.gateway.id,
        isActive: form.isActive,
        publishableKey: form.publishableKey || undefined,
        secretKey: form.secretKey || undefined,
        webhookSecret: form.webhookSecret || undefined,
        serviceId: form.serviceId || undefined,
        sandbox: form.sandbox,
      }, { onSuccess: () => setDialog(null) });
    }
  }

  function deleteGateway(id: string) {
    deleteMutation.mutate({ id }, { onSuccess: () => setDialog(null) });
  }

  const isSheetOpen = dialog?.type === "add" || dialog?.type === "edit";
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <Button variant="outline" size="sm" onClick={openAdd} disabled={availableProviders.length === 0}>
          <Plus />
          {t("addProvider")}
        </Button>
      </div>

      {gateways.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
            <CreditCard className="size-6 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t("empty")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("addProvider")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={openAdd} disabled={availableProviders.length === 0}>
            <Plus />
            {t("addProvider")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[36px_1fr_120px_40px] items-center border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("statusColumn")}</span>
            <span />
          </div>
          {gateways.map((g, i) => (
            <div
              key={g.id}
              className={cn(
                "grid grid-cols-[36px_1fr_120px_40px] items-center px-4 py-3 transition-colors hover:bg-muted/30",
                i < gateways.length - 1 && "border-b border-border",
              )}
            >
              <ProviderLogo provider={g.provider as ProviderType} />
              <div className="min-w-0 pl-3">
                <p className="text-sm font-medium text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground">{providerLabels[g.provider] ?? g.provider}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={g.isActive ? "success" : "secondary"}>
                  {g.isActive ? t("active") : t("inactive")}
                </Badge>
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground"
                      onClick={() => openEdit(g)}
                    >
                      <Pencil className="size-3.5" />
                      {tc("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-destructive focus:text-destructive"
                      onClick={() => setDialog({ type: "delete", gateway: g })}
                    >
                      <Trash2 className="size-3.5" />
                      {tc("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit sheet */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <SheetPopup
          side={isMobile ? "bottom" : "right"}
          showCloseButton={false}
          className={isMobile ? "rounded-t-2xl" : undefined}
        >
          <SheetHeader>
            <SheetTitle>
              {dialog?.type === "add" ? t("addTitle") : t("editTitle")}
            </SheetTitle>
            <SheetDescription>
              {dialog?.type === "add" ? t("addDescription") : t("editDescription")}
            </SheetDescription>
          </SheetHeader>
          <SheetPanel>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">{t("providerType")}</Label>
                {dialog?.type === "edit" ? (
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3">
                    <ProviderLogo provider={form.provider as ProviderType} size="sm" />
                    <span className="text-xs text-foreground">{providerLabels[form.provider] ?? form.provider}</span>
                  </div>
                ) : (
                  <Select
                    value={form.provider}
                    onValueChange={(v) => setForm((s) => ({ ...s, provider: v ?? s.provider }))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string) => (
                          <span className="flex items-center gap-2">
                            <ProviderLogo provider={v as ProviderType} size="sm" />
                            {providerLabels[v] ?? v}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <ProviderLogo provider={p} size="sm" />
                            {providerLabels[p]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {form.provider === "stripe" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("publicKey")}</Label>
                    <Input
                      value={form.publishableKey}
                      onChange={(e) => setForm((s) => ({ ...s, publishableKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "pk_…"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("secretKey")}</Label>
                    <Input
                      type="password"
                      value={form.secretKey}
                      onChange={(e) => setForm((s) => ({ ...s, secretKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "sk_…"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("webhookSecret")}</Label>
                    <Input
                      type="password"
                      value={form.webhookSecret}
                      onChange={(e) => setForm((s) => ({ ...s, webhookSecret: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : t("webhookSecretPlaceholder")}
                      className="font-mono text-xs"
                    />
                  </div>
                  <WebhookEndpointInfo provider={form.provider} />
                </div>
              )}

              {form.provider === "simpay" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("apiPassword")}</Label>
                    <Input
                      type="password"
                      value={form.secretKey}
                      onChange={(e) => setForm((s) => ({ ...s, secretKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : t("apiPasswordPlaceholder")}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("serviceId")}</Label>
                    <Input
                      value={form.serviceId}
                      onChange={(e) => setForm((s) => ({ ...s, serviceId: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : t("serviceIdPlaceholder")}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("signatureKey")}</Label>
                    <Input
                      type="password"
                      value={form.webhookSecret}
                      onChange={(e) => setForm((s) => ({ ...s, webhookSecret: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : t("signatureKeyPlaceholder")}
                      className="font-mono text-xs"
                    />
                  </div>
                  <WebhookEndpointInfo provider={form.provider} />
                </div>
              )}

              {form.provider === "paypal" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("clientId")}</Label>
                    <Input
                      value={form.publishableKey}
                      onChange={(e) => setForm((s) => ({ ...s, publishableKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "Ab…"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("secretKey")}</Label>
                    <Input
                      type="password"
                      value={form.secretKey}
                      onChange={(e) => setForm((s) => ({ ...s, secretKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "E…"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("webhookId")}</Label>
                    <Input
                      type="password"
                      value={form.webhookSecret}
                      onChange={(e) => setForm((s) => ({ ...s, webhookSecret: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "WH-…"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-xs font-medium">{t("sandbox")}</Label>
                      <p className="text-xs text-muted-foreground">{t("sandboxDescription")}</p>
                    </div>
                    <Switch checked={form.sandbox} onCheckedChange={(v) => setForm((s) => ({ ...s, sandbox: !!v }))} />
                  </div>
                  <WebhookEndpointInfo provider={form.provider} />
                </div>
              )}

              {form.provider === "przelewy24" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("merchantId")}</Label>
                    <Input
                      value={form.publishableKey}
                      onChange={(e) => setForm((s) => ({ ...s, publishableKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "12345"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("posId")}</Label>
                    <Input
                      value={form.serviceId}
                      onChange={(e) => setForm((s) => ({ ...s, serviceId: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : "12345"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("apiKey")}</Label>
                    <Input
                      type="password"
                      value={form.secretKey}
                      onChange={(e) => setForm((s) => ({ ...s, secretKey: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : ""}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">{t("crc")}</Label>
                    <Input
                      type="password"
                      value={form.webhookSecret}
                      onChange={(e) => setForm((s) => ({ ...s, webhookSecret: e.target.value }))}
                      placeholder={dialog?.type === "edit" ? t("keepExisting") : ""}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-xs font-medium">{t("sandbox")}</Label>
                      <p className="text-xs text-muted-foreground">{t("sandboxDescription")}</p>
                    </div>
                    <Switch checked={form.sandbox} onCheckedChange={(v) => setForm((s) => ({ ...s, sandbox: !!v }))} />
                  </div>
                  <WebhookEndpointInfo provider={form.provider} />
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("statusSection")}</span>
                </div>
                <div className="divide-y divide-border px-4">
                  <SettingRow label={t("isActive")} htmlFor={activeId}>
                    <Switch
                      id={activeId}
                      checked={form.isActive}
                      onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          </SheetPanel>
          <SheetFooter variant="default">
            <SheetClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </SheetClose>
            <Button size="sm" onClick={saveGateway} disabled={isSaving}>
              {tc("save")}
            </Button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog
        open={dialog?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogPopup showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => dialog?.type === "delete" && deleteGateway(dialog.gateway.id)}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

// ─── Catalog tab ──────────────────────────────────────────────────────────────

type CatalogDialogState =
  | null
  | { type: "addCategory" }
  | { type: "editCategory"; category: Category }
  | { type: "deleteCategory"; category: Category }
  | { type: "addPlan"; categoryId: string }
  | { type: "editPlan"; plan: Plan }
  | { type: "deletePlan"; plan: Plan };

function EggsDrawerContent({ value, onChange, groups, searchPlaceholder, noResults }: { value: string[]; onChange: (v: string[]) => void; groups: { id: string; label: string; items: { id: string; label: string }[] }[]; searchPlaceholder: string; noResults: string }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, groups]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function toggleGroup(group: { id: string; label: string; items: { id: string; label: string }[] }) {
    const ids = group.items.map((i) => i.id);
    const allChecked = ids.every((id) => value.includes(id));
    onChange(allChecked ? value.filter((v) => !ids.includes(v)) : [...new Set([...value, ...ids])]);
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <svg className="size-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            autoFocus
            aria-label={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{noResults}</p>
      ) : (
        filtered.map((group) => {
          const groupChecked = group.items.every((i) => value.includes(i.id));
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  groupChecked ? "border-primary bg-primary" : "border-border bg-background",
                )}>
                  {groupChecked && <Check className="size-3 text-primary-foreground" />}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
              </button>
              {group.items.map((item) => {
                const checked = value.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-center gap-3 py-3 pr-4 pl-11 text-left active:bg-muted/60"
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked ? "border-primary bg-primary" : "border-border bg-background",
                    )}>
                      {checked && <Check className="size-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm text-foreground">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

function CatalogTab() {
  const t = useTranslations("admin.billing.catalog");
  const tc = useTranslations("common");
  const ts = useTranslations("panel.billing.specs");
  const isMobile = useMediaQuery("max-sm");

  const { data: categories = [], isLoading: catsLoading } = useQuery(orpc.billing.adminListCategories.queryOptions());
  const { data: plans = [], isLoading: plansLoading } = useQuery(orpc.billing.adminListProducts.queryOptions());
  const { data: allEggsRaw = [] } = useQuery(orpc.eggs.listAll.queryOptions());
  const { data: allNodes = [] } = useQuery(orpc.nodes.list.queryOptions());

  const eggGroups = useMemo(() => {
    const byNest = new Map<string, { nestId: string; nestName: string; eggs: { id: string; name: string }[] }>();
    for (const e of allEggsRaw) {
      if (!byNest.has(e.nestId)) byNest.set(e.nestId, { nestId: e.nestId, nestName: e.nestName, eggs: [] });
      byNest.get(e.nestId)!.eggs.push({ id: e.id, name: e.name });
    }
    return Array.from(byNest.values()).map((n) => ({
      id: n.nestId,
      label: n.nestName,
      items: n.eggs.map((e) => ({ id: e.id, label: e.name })),
    }));
  }, [allEggsRaw]);

  const eggNameById = useMemo(
    () => new Map(allEggsRaw.map((e) => [e.id, e.name])),
    [allEggsRaw],
  );
  const [dialog, setDialog] = useState<CatalogDialogState>(null);

  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set());

  function invalidateCatalog() {
    void queryClient.invalidateQueries({ queryKey: orpc.billing.adminListCategories.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.billing.adminListProducts.key() });
  }

  const createCategoryMutation = useMutation(orpc.billing.adminCreateCategory.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("saved")); },
  }));
  const updateCategoryMutation = useMutation(orpc.billing.adminUpdateCategory.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("saved")); },
  }));
  const deleteCategoryMutation = useMutation(orpc.billing.adminDeleteCategory.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("deleted")); },
  }));
  const createProductMutation = useMutation(orpc.billing.adminCreateProduct.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("saved")); },
  }));
  const updateProductMutation = useMutation(orpc.billing.adminUpdateProduct.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("saved")); },
  }));
  const deleteProductMutation = useMutation(orpc.billing.adminDeleteProduct.mutationOptions({
    onSuccess: () => { invalidateCatalog(); setDialog(null); toast.success(tc("deleted")); },
  }));

  const [catForm, setCatForm] = useState<Omit<Category, "id">>({
    name: "",
    slug: "",
    description: "",
    isActive: true,
    sortOrder: 0,
    icon: "",
    bannerUrl: "",
  });
  const [catIconUploading, setCatIconUploading] = useState(false);
  const [catIconError, setCatIconError] = useState<string | null>(null);
  const [catBannerUploading, setCatBannerUploading] = useState(false);
  const [catBannerError, setCatBannerError] = useState<string | null>(null);
  const [planIconUploading, setPlanIconUploading] = useState(false);
  const [planIconError, setPlanIconError] = useState<string | null>(null);
  const [eggsDrawerOpen, setEggsDrawerOpen] = useState(false);
  const [nodesDrawerOpen, setNodesDrawerOpen] = useState(false);

  const nodeGroups = useMemo(
    () => allNodes.length === 0 ? [] : [{ id: "all", label: t("plans.nodes"), items: allNodes.map((n) => ({ id: n.id, label: n.name })) }],
    [allNodes, t],
  );
  const nodeNameById = useMemo(() => new Map(allNodes.map((n) => [n.id, n.name])), [allNodes]);

  async function uploadBillingImage(
    file: File,
    setUploading: (v: boolean) => void,
    setError: (v: string | null) => void,
    onUrl: (url: string) => void,
  ) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files/upload/billing-image", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? t("uploadFailed"));
      } else {
        const data = await res.json() as { url: string };
        onUrl(data.url);
      }
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }
  const defaultResources: ResourceLimits = { cpu: 2, ram: 2, disk: 10, backups: 0, allocations: 1, databases: 0, eggs: [], nodes: [] };
  const [planForm, setPlanForm] = useState<Omit<Plan, "id">>({
    categoryId: "",
    name: "",
    description: "",
    isActive: true,
    isPublic: true,
    isFeatured: false,
    icon: "",
    resources: defaultResources,
    prices: [],
  });

  const catActiveId = useId();
  const planActiveId = useId();
  const planPublicId = useId();

  const durationLabels: Record<Duration, string> = {
    "7day": t("plans.durations.7day"),
    "1month": t("plans.durations.1month"),
    "3months": t("plans.durations.3months"),
    "6months": t("plans.durations.6months"),
    "1year": t("plans.durations.1year"),
  };

  function toggleCat(id: string) {
    setExpandedCats((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Category CRUD
  function openAddCategory() {
    setCatForm({ name: "", slug: "", description: "", isActive: true, sortOrder: categories.length, icon: "", bannerUrl: "" });
    setDialog({ type: "addCategory" });
  }
  function openEditCategory(c: Category) {
    setCatForm({ name: c.name, slug: c.slug, description: c.description, isActive: c.isActive, sortOrder: c.sortOrder, icon: c.icon, bannerUrl: c.bannerUrl });
    setDialog({ type: "editCategory", category: c });
  }
  function saveCategory() {
    const payload = { name: catForm.name, slug: catForm.slug, description: catForm.description, isActive: catForm.isActive, sortOrder: catForm.sortOrder, icon: catForm.icon || undefined, coverImage: catForm.bannerUrl || undefined };
    if (dialog?.type === "addCategory") {
      createCategoryMutation.mutate({ ...payload, sortOrder: payload.sortOrder ?? categories.length });
    } else if (dialog?.type === "editCategory") {
      updateCategoryMutation.mutate({ id: dialog.category.id, ...payload, icon: catForm.icon || null, coverImage: catForm.bannerUrl || null });
    }
  }
  function deleteCategory(id: string) {
    deleteCategoryMutation.mutate({ id });
  }

  // Plan CRUD
  function openAddPlan(categoryId: string) {
    setPlanForm({ categoryId, name: "", description: "", isActive: true, isPublic: true, isFeatured: false, icon: "", resources: { ...defaultResources }, prices: [] });
    setDialog({ type: "addPlan", categoryId });
  }
  function openEditPlan(p: Plan) {
    setPlanForm({ categoryId: p.categoryId, name: p.name, description: p.description, isActive: p.isActive, isPublic: p.isPublic, isFeatured: p.isFeatured, icon: p.icon, resources: p.resources, prices: p.prices });
    setDialog({ type: "editPlan", plan: p });
  }
  function savePlan() {
    const prices = planForm.prices.map((p) => ({ duration: p.duration, priceCents: Math.round(p.price * 100) }));
    if (prices.some((p) => !Number.isFinite(p.priceCents) || p.priceCents < 0)) return;
    const { cpu, ram, disk, backups, allocations, databases } = planForm.resources;
    if ([cpu, ram, disk, backups, allocations, databases].some((v) => !Number.isFinite(v) || v < 0)) return;
    const payload = {
      categoryId: planForm.categoryId || undefined,
      name: planForm.name,
      description: planForm.description,
      isActive: planForm.isActive,
      isPublic: planForm.isPublic,
      isFeatured: planForm.isFeatured,
      icon: planForm.icon || undefined,
      resourceLimits: planForm.resources,
      prices,
    };
    if (dialog?.type === "addPlan") {
      createProductMutation.mutate(payload);
    } else if (dialog?.type === "editPlan") {
      updateProductMutation.mutate({ id: dialog.plan.id, ...payload, icon: planForm.icon || null });
    }
  }
  function deletePlan(id: string) {
    deleteProductMutation.mutate({ id });
  }

  function addPlanPrice(duration: Duration) {
    setPlanForm((s) => ({ ...s, prices: [...s.prices, { id: crypto.randomUUID(), duration, price: 0 }] }));
  }
  function removePlanPrice(id: string) {
    setPlanForm((s) => ({ ...s, prices: s.prices.filter((p) => p.id !== id) }));
  }
  function updatePlanPrice(id: string, price: number) {
    setPlanForm((s) => ({ ...s, prices: s.prices.map((p) => (p.id === id ? { ...p, price } : p)) }));
  }

  function EntityRowMenu({
    items,
  }: {
    items: { label: string; icon: typeof Pencil; onClick: () => void; destructive?: boolean }[];
  }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {items.map((item, i) => (
            <DropdownMenuItem
              key={i}
              onClick={item.onClick}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs",
                item.destructive ? "text-destructive focus:text-destructive" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-3.5 shrink-0" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (catsLoading || plansLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">{tc("loading")}</div>;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("categories.title")}</p>
        <Button variant="outline" size="xs" onClick={openAddCategory}>
          <Plus />
          {t("categories.add")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Layers className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("categories.empty")}</p>
          </div>
        ) : (
          categories.map((cat, catIndex) => {
            const catPlans = plans.filter((p) => p.categoryId === cat.id);
            const isCatExpanded = expandedCats.has(cat.id);
            const isLastCat = catIndex === categories.length - 1;

            return (
              <div
                key={cat.id}
                className={cn(!isLastCat || isCatExpanded ? "border-b border-border" : "")}
              >
                {/* Category row */}
                <div className="group relative flex items-center gap-3 overflow-hidden px-4 py-3">
                  {cat.bannerUrl && (
                    <>
                      <img src={cat.bannerUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
                    </>
                  )}
                  {!cat.bannerUrl && <div className="absolute inset-0 bg-muted/30" />}
                  <button
                    type="button"
                    onClick={() => toggleCat(cat.id)}
                    className="relative flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform duration-200", isCatExpanded && "rotate-90")}
                    />
                  </button>
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
                    {cat.icon
                      ? <img src={cat.icon} alt="" className="h-full w-full object-cover" />
                      : <Layers className="size-3.5 text-muted-foreground" />
                    }
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    {cat.description && (
                      <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{cat.description}</span>
                    )}
                  </div>
                  <div className="relative flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {t("planCount", { count: catPlans.length })}
                    </span>
                    <Badge variant={cat.isActive ? "success" : "secondary"}>
                      {cat.isActive ? t("plans.active") : t("plans.inactive")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); openAddPlan(cat.id); }}
                    >
                      <Plus />
                      {t("plans.add")}
                    </Button>
                    <EntityRowMenu
                      items={[
                        { label: tc("edit"), icon: Pencil, onClick: () => openEditCategory(cat) },
                        { label: tc("delete"), icon: Trash2, onClick: () => setDialog({ type: "deleteCategory", category: cat }), destructive: true },
                      ]}
                    />
                  </div>
                </div>

                {/* Plans directly under category */}
                <AnimatePresence initial={false}>
                  {isCatExpanded && (
                    <motion.div
                      key={cat.id + "-plans"}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                  {catPlans.length === 0 ? (
                    <div className="flex items-center gap-2 border-t border-border/60 py-2.5 pl-14 pr-4 text-xs text-muted-foreground/50">
                      <Tag className="size-3.5 shrink-0" />
                      {t("plans.noneInProduct")}
                    </div>
                  ) : (
                    catPlans.map((plan) => {
                      const monthlyPrice = plan.prices.find((p) => p.duration === "1month") ?? plan.prices[0];

                      return (
                        <div
                          key={plan.id}
                          className="flex items-center gap-3 border-t border-border/60 py-2.5 pl-11 pr-4 hover:bg-muted/10"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/50">
                            {(plan.icon || cat.icon)
                              ? <img src={plan.icon || cat.icon} alt="" className="h-full w-full object-cover" />
                              : <Tag className="size-3 text-muted-foreground" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-sm text-foreground">{plan.name}</span>
                              {plan.description && (
                                <span className="hidden text-xs text-muted-foreground sm:inline">{plan.description}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {monthlyPrice && (
                              <span className="text-xs font-semibold tabular-nums text-foreground">
                                {formatPrice(monthlyPrice.price)}
                                <span className="font-normal text-muted-foreground">/mo</span>
                              </span>
                            )}
                            {plan.isFeatured && (
                              <Tooltip>
                                <TooltipTrigger className="flex items-center">
                                  <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                                </TooltipTrigger>
                                <TooltipPopup>{t("plans.featured")}</TooltipPopup>
                              </Tooltip>
                            )}
                            {!plan.isActive && (
                              <Tooltip>
                                <TooltipTrigger className="flex items-center">
                                  <CircleOff className="size-3.5 shrink-0 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipPopup>{t("plans.inactive")}</TooltipPopup>
                              </Tooltip>
                            )}
                            {!plan.isPublic && (
                              <Tooltip>
                                <TooltipTrigger className="flex items-center">
                                  <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipPopup>{t("plans.unlisted")}</TooltipPopup>
                              </Tooltip>
                            )}
                            <EntityRowMenu
                              items={[
                                { label: tc("edit"), icon: Pencil, onClick: () => openEditPlan(plan) },
                                { label: tc("delete"), icon: Trash2, onClick: () => setDialog({ type: "deletePlan", plan }), destructive: true },
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                  <button
                    type="button"
                    onClick={() => openAddPlan(cat.id)}
                    className="flex w-full items-center gap-3 border-t border-border/60 py-2.5 pl-11 pr-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/10 sm:hidden"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60">
                      <Plus className="size-3" />
                    </div>
                    {t("plans.add")}
                  </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Category sheet */}
      <Sheet
        open={dialog?.type === "addCategory" || dialog?.type === "editCategory"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
      >
        <SheetPopup
          side={isMobile ? "bottom" : "right"}
          showCloseButton={false}
          className={isMobile ? "rounded-t-2xl" : undefined}
        >
          <SheetHeader>
            <SheetTitle>
              {dialog?.type === "addCategory" ? t("categories.add") : t("categories.edit")}
            </SheetTitle>
            <SheetDescription>
              {dialog?.type === "addCategory" ? t("categories.addDescription") : t("categories.editDescription")}
            </SheetDescription>
          </SheetHeader>
          <SheetPanel>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">{t("categories.name")}</Label>
                <Input
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm((s) => ({ ...s, name: e.target.value, slug: slugify(e.target.value) }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">{t("categories.slug")}</Label>
                <Input
                  value={catForm.slug}
                  onChange={(e) => setCatForm((s) => ({ ...s, slug: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">{t("categories.description")}</Label>
                <Input
                  value={catForm.description}
                  onChange={(e) => setCatForm((s) => ({ ...s, description: e.target.value }))}
                />
              </div>
              <CategoryPreviewCard
                name={catForm.name || t("categories.previewName")}
                description={catForm.description || t("categories.previewDescription")}
                iconUrl={catForm.icon}
                bannerUrl={catForm.bannerUrl}
                iconUploading={catIconUploading}
                bannerUploading={catBannerUploading}
                iconError={catIconError}
                bannerError={catBannerError}
                onIconUpload={(f) => void uploadBillingImage(f, setCatIconUploading, setCatIconError, (url) => setCatForm((s) => ({ ...s, icon: url })))}
                onBannerUpload={(f) => void uploadBillingImage(f, setCatBannerUploading, setCatBannerError, (url) => setCatForm((s) => ({ ...s, bannerUrl: url })))}
                onIconRemove={() => { setCatForm((s) => ({ ...s, icon: "" })); setCatIconError(null); }}
                onBannerRemove={() => { setCatForm((s) => ({ ...s, bannerUrl: "" })); setCatBannerError(null); }}
              />
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("categories.statusSection")}</span>
                </div>
                <div className="px-4">
                  <SettingRow label={t("categories.isActive")} htmlFor={catActiveId}>
                    <Switch
                      id={catActiveId}
                      checked={catForm.isActive}
                      onCheckedChange={(v) => setCatForm((s) => ({ ...s, isActive: v }))}
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          </SheetPanel>
          <SheetFooter variant="default">
            <SheetClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </SheetClose>
            <Button size="sm" onClick={saveCategory} disabled={!catForm.name}>
              {tc("save")}
            </Button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      <Dialog
        open={dialog?.type === "deleteCategory"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogPopup showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("categories.delete")}</DialogTitle>
            <DialogDescription>
              {t("categories.deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                dialog?.type === "deleteCategory" &&
                deleteCategory(dialog.category.id)
              }
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Plan sheet */}
      <Sheet
        open={dialog?.type === "addPlan" || dialog?.type === "editPlan"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
      >
        <SheetPopup
          side={isMobile ? "bottom" : "right"}
          showCloseButton={false}
          className={isMobile ? "rounded-t-2xl" : undefined}
        >
          <SheetHeader>
            <SheetTitle>
              {dialog?.type === "addPlan" ? t("plans.add") : t("plans.edit")}
            </SheetTitle>
            <SheetDescription>
              {dialog?.type === "addPlan" ? t("plans.addDescription") : t("plans.editDescription")}
            </SheetDescription>
          </SheetHeader>
          <SheetPanel>
            <div className="flex flex-col gap-5">
              <PlanPreviewCard
                name={planForm.name || t("plans.previewName")}
                description={planForm.description || t("plans.previewDescription")}
                planIconUrl={planForm.icon}
                categoryIconUrl={categories.find((c) => c.id === planForm.categoryId)?.icon ?? ""}
                categoryName={categories.find((c) => c.id === planForm.categoryId)?.name ?? ""}
                resources={planForm.resources}
                prices={planForm.prices}
                iconUploading={planIconUploading}
                iconError={planIconError}
                onIconUpload={(f) => void uploadBillingImage(f, setPlanIconUploading, setPlanIconError, (url) => setPlanForm((s) => ({ ...s, icon: url })))}
                onIconRemove={() => { setPlanForm((s) => ({ ...s, icon: "" })); setPlanIconError(null); }}
              />
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">{t("plans.name")}</Label>
                  <Input
                    value={planForm.name}
                    onChange={(e) => setPlanForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">{t("plans.description")}</Label>
                  <Input
                    value={planForm.description}
                    onChange={(e) => setPlanForm((s) => ({ ...s, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("plans.resources")}</span>
                </div>
                <div className="divide-y divide-border px-4">
                  <SettingRow label={t("plans.cpu")}>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" min={1} max={64}
                        value={planForm.resources.cpu}
                        onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, cpu: Number(e.target.value) } }))}
                        className="w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground">{ts("cpu")}</span>
                    </div>
                  </SettingRow>
                  <SettingRow label={t("plans.ram")}>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" min={0.5} step={0.5}
                        value={planForm.resources.ram}
                        onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, ram: Number(e.target.value) } }))}
                        className="w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground">GB</span>
                    </div>
                  </SettingRow>
                  <SettingRow label={t("plans.disk")}>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" min={1}
                        value={planForm.resources.disk}
                        onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, disk: Number(e.target.value) } }))}
                        className="w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground">GB</span>
                    </div>
                  </SettingRow>
                  <SettingRow label={t("plans.backups")}>
                    <Input
                      type="number" min={0}
                      value={planForm.resources.backups}
                      onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, backups: Number(e.target.value) } }))}
                      className="w-20 text-right"
                    />
                  </SettingRow>
                  <SettingRow label={t("plans.allocations")}>
                    <Input
                      type="number" min={1}
                      value={planForm.resources.allocations}
                      onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, allocations: Number(e.target.value) } }))}
                      className="w-20 text-right"
                    />
                  </SettingRow>
                  <SettingRow label={t("plans.databases")}>
                    <Input
                      type="number" min={0}
                      value={planForm.resources.databases}
                      onChange={(e) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, databases: Number(e.target.value) } }))}
                      className="w-20 text-right"
                    />
                  </SettingRow>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("plans.eggs")}</p>
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setEggsDrawerOpen(true)}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/40"
                    >
                      <span className="truncate text-left">
                        {planForm.resources.eggs.length === 0
                          ? <span className="text-muted-foreground">{t("plans.selectEggs")}</span>
                          : planForm.resources.eggs.length <= 3
                            ? planForm.resources.eggs.map((id) => eggNameById.get(id) ?? id).join(", ")
                            : `${planForm.resources.eggs.slice(0, 2).map((id) => eggNameById.get(id) ?? id).join(", ")} +${planForm.resources.eggs.length - 2}`
                        }
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <GroupedMultiSelect
                      value={planForm.resources.eggs}
                      onChange={(eggs) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, eggs } }))}
                      groups={eggGroups}
                      placeholder={t("plans.selectEggs")}
                      searchPlaceholder={t("plans.searchEggs")}
                      noResultsText={t("plans.noResults")}
                    />
                  )}
                </div>
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("plans.nodes")}</p>
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setNodesDrawerOpen(true)}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/40"
                    >
                      <span className="truncate text-left">
                        {planForm.resources.nodes.length === 0
                          ? <span className="text-muted-foreground">{t("plans.selectNodes")}</span>
                          : planForm.resources.nodes.length <= 3
                            ? planForm.resources.nodes.map((id) => nodeNameById.get(id) ?? id).join(", ")
                            : `${planForm.resources.nodes.slice(0, 2).map((id) => nodeNameById.get(id) ?? id).join(", ")} +${planForm.resources.nodes.length - 2}`
                        }
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <GroupedMultiSelect
                      value={planForm.resources.nodes}
                      onChange={(nodes) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, nodes } }))}
                      groups={nodeGroups}
                      placeholder={t("plans.selectNodes")}
                      searchPlaceholder={t("plans.searchNodes")}
                      noResultsText={t("plans.noResults")}
                    />
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("plans.prices")}</span>
                  {(() => {
                    const used = new Set(planForm.prices.map((p) => p.duration));
                    const available = DURATIONS.filter((d) => !used.has(d));
                    if (available.length === 0) return null;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="xs" />}>
                          <Plus />
                          {t("plans.addPrice")}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {available.map((d) => (
                            <DropdownMenuItem key={d} onClick={() => addPlanPrice(d)}>
                              {durationLabels[d]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                </div>
                <div className="flex flex-col divide-y divide-border/60">
                  {planForm.prices.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground/50">{t("plans.noPrices")}</p>
                  ) : (
                    [...planForm.prices]
                      .sort((a, b) => DURATIONS.indexOf(a.duration) - DURATIONS.indexOf(b.duration))
                      .map((pr) => (
                        <div key={pr.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-24 shrink-0 text-xs text-muted-foreground">{durationLabels[pr.duration]}</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={pr.price}
                            onChange={(e) => updatePlanPrice(pr.id, Number(e.target.value))}
                            className="flex-1"
                            placeholder="0.00"
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removePlanPrice(pr.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("plans.statusSection")}</span>
                </div>
                <div className="divide-y divide-border px-4">
                  <SettingRow label={t("plans.isFeatured")} description={t("plans.isFeaturedDescription")}>
                    <Switch
                      checked={planForm.isFeatured}
                      onCheckedChange={(v) => setPlanForm((s) => ({ ...s, isFeatured: v }))}
                    />
                  </SettingRow>
                  <SettingRow label={t("plans.isActive")} htmlFor={planActiveId}>
                    <Switch
                      id={planActiveId}
                      checked={planForm.isActive}
                      onCheckedChange={(v) => setPlanForm((s) => ({ ...s, isActive: v }))}
                    />
                  </SettingRow>
                  <SettingRow label={t("plans.isPublic")} description={t("plans.isPublicDescription")} htmlFor={planPublicId}>
                    <Switch
                      id={planPublicId}
                      checked={planForm.isPublic}
                      onCheckedChange={(v) => setPlanForm((s) => ({ ...s, isPublic: v }))}
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          </SheetPanel>
          <SheetFooter variant="default">
            <SheetClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </SheetClose>
            <Button size="sm" onClick={savePlan} disabled={!planForm.name}>
              {tc("save")}
            </Button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      <Sheet open={eggsDrawerOpen} onOpenChange={setEggsDrawerOpen}>
        <SheetPopup side="bottom" showCloseButton={false} className="rounded-t-2xl max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{t("plans.eggs")}</SheetTitle>
          </SheetHeader>
          <SheetPanel className="overflow-y-auto">
            <EggsDrawerContent
              value={planForm.resources.eggs}
              onChange={(eggs) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, eggs } }))}
              groups={eggGroups}
              searchPlaceholder={t("plans.searchEggs")}
              noResults={t("plans.noResults")}
            />
          </SheetPanel>
          <SheetFooter variant="default">
            <Button size="sm" className="w-full" onClick={() => setEggsDrawerOpen(false)}>
              {tc("done")}
            </Button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      <Sheet open={nodesDrawerOpen} onOpenChange={setNodesDrawerOpen}>
        <SheetPopup side="bottom" showCloseButton={false} className="rounded-t-2xl max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{t("plans.nodes")}</SheetTitle>
          </SheetHeader>
          <SheetPanel className="overflow-y-auto">
            <EggsDrawerContent
              value={planForm.resources.nodes}
              onChange={(nodes) => setPlanForm((s) => ({ ...s, resources: { ...s.resources, nodes } }))}
              groups={nodeGroups}
              searchPlaceholder={t("plans.searchNodes")}
              noResults={t("plans.noResults")}
            />
          </SheetPanel>
          <SheetFooter variant="default">
            <Button size="sm" className="w-full" onClick={() => setNodesDrawerOpen(false)}>
              {tc("done")}
            </Button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      <Dialog
        open={dialog?.type === "deletePlan"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogPopup showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("plans.delete")}</DialogTitle>
            <DialogDescription>
              {t("plans.deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {tc("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                dialog?.type === "deletePlan" && deletePlan(dialog.plan.id)
              }
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ["settings", "providers", "catalog"] as const;
type Tab = (typeof TABS)[number];

export default function AdminBillingPage() {
  const t = useTranslations("admin.billing");
  const [tab, setTab] = useState<Tab>("settings");

  const maxWidth =
    tab === "catalog"
      ? "max-w-5xl"
      : tab === "providers"
        ? "max-w-4xl"
        : "max-w-3xl";

  return (
    <div className="flex-1 overflow-auto px-4 py-5 sm:px-6">
      <div className={cn("mx-auto flex flex-col gap-4", maxWidth)}>
        <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v) setTab(v as Tab);
          }}
        >
          <div className="border-b border-border">
            <TabsList variant="underline">
              <TabsTab value="settings">{t("tabs.settings")}</TabsTab>
              <TabsTab value="providers">{t("tabs.providers")}</TabsTab>
              <TabsTab value="catalog">{t("tabs.catalog")}</TabsTab>
            </TabsList>
          </div>
          <TabsPanel value="settings" className="pt-4">
            {tab === "settings" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <SettingsTab />
              </motion.div>
            )}
          </TabsPanel>
          <TabsPanel value="providers" className="pt-4">
            {tab === "providers" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <ProvidersTab />
              </motion.div>
            )}
          </TabsPanel>
          <TabsPanel value="catalog" className="pt-4">
            {tab === "catalog" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <CatalogTab />
              </motion.div>
            )}
          </TabsPanel>
        </Tabs>
      </div>
    </div>
  );
}
