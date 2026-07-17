"use client";

import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Server, Copy, Terminal, Globe, ChevronDown, ExternalLink, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@struxa/ui/components/dialog";
import { Button } from "@struxa/ui/components/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { orpc, queryClient } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";
import { cn } from "@struxa/ui/lib/utils";
import { useMediaQuery } from "@struxa/ui/hooks/use-media-query";
import { Sheet, SheetPopup, SheetHeader, SheetTitle, SheetDescription } from "@struxa/ui/components/sheet";

function StatRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex flex-col gap-1.5 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40 transition-colors">
      <div className="flex flex-col gap-0.5 max-w-xs">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-green-500" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function CustomSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex w-56 items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border/80 hover:bg-muted data-[popup-open]:border-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="shadow-md">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-blue-500" : "bg-transparent"}`}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DebouncedInput({
  defaultValue,
  onSave,
  disabled,
  placeholder,
  className,
}: {
  defaultValue: string;
  onSave: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(v), 800);
  }

  return (
    <input
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

function isBoolVariable(rules: string | null | undefined): boolean {
  return !!(rules && (rules.includes("in:0,1") || rules.includes("in:1,0")));
}

type ServerVariable = {
  variableId: string;
  variableValue: string | null;
  variable: {
    name: string;
    description: string | null;
    envVariable: string;
    defaultValue: string | null;
    userEditable: boolean;
    rules: string | null;
  };
};

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.settings");
  const tBilling = useTranslations("panel.billing");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const [reinstallConfirm, setReinstallConfirm] = useState(false);
  const [reinstallStep, setReinstallStep] = useState<1 | 2>(1);
  const [selectedEggId, setSelectedEggId] = useState<string | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendPriceId, setExtendPriceId] = useState<string | null>(null);
  const isMobile = useMediaQuery("max-sm");
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server, isPending: serverPending } = useQuery(
    orpc.servers.get.queryOptions({ input: { id } }),
  );

  const { data: planEggs = [] } = useQuery(
    orpc.servers.listPlanEggs.queryOptions({ input: { serverId: id } }),
  );

  const subscriptionQuery = useQuery({
    ...orpc.billing.getServerSubscription.queryOptions({ input: { serverId: id } }),
    enabled: !!(server?.subscriptionId),
  });

  useEffect(() => {
    if (!extendPriceId && subscriptionQuery.data?.availablePrices[0]) {
      setExtendPriceId(subscriptionQuery.data.availablePrices[0].id);
    }
  }, [subscriptionQuery.data, extendPriceId]);

  const extendMutation = useMutation({
    ...orpc.billing.extendSubscription.mutationOptions(),
    meta: { customError: true },
    onSuccess: () => {
      setExtendOpen(false);
      setExtendPriceId(null);
      void queryClient.invalidateQueries(orpc.billing.getServerSubscription.queryOptions({ input: { serverId: id } }));
      toast.success(t("subscriptionExtendSuccess"));
    },
    onError: (error: Error & { data?: { code?: string } }) => {
      if (error.data?.code === "INSUFFICIENT_FUNDS") {
        toast.error(t("subscriptionExtendInsufficientFunds"));
      } else {
        toast.error(error.message);
      }
    },
  });

  const reinstallMutation = useMutation({
    ...orpc.servers.reinstall.mutationOptions(),
    onSuccess: () => {
      setReinstallConfirm(false);
      setReinstallStep(1);
      setSelectedEggId(null);
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      toast.success(t("reinstallTriggeredToast"));
    },
  });

  const renameMutation = useMutation(orpc.servers.rename.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      toast.success(tCommon("saved"));
    },
  }));
  const updateVariableMutation = useMutation(orpc.servers.updateStartupVariable.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      toast.success(tCommon("saved"));
    },
  }));
  const updateImageMutation = useMutation(orpc.servers.updateDockerImage.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      toast.success(tCommon("saved"));
    },
  }));

  function saveImage(image: string) {
    updateImageMutation.mutate({ serverId: id, image });
  }

  function saveServerName(name: string) {
    renameMutation.mutate({ serverId: id, name });
  }

  function saveVariable(envVariable: string, value: string) {
    updateVariableMutation.mutate({ serverId: id, envVariable, value });
  }

  if (isPending || !session) return <Loader />;
  if (serverPending) return <Loader />;

  const node = server?.node as { name?: string; fqdn?: string; daemonSFTP?: number } | undefined;
  const sftp = {
    host: node?.fqdn ?? "—",
    port: node?.daemonSFTP ?? 2022,
    username: `${session?.user.email?.split("@")[0] ?? "user"}.${server?.uuidShort ?? ""}`,
  };

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function closeReinstall() {
    setReinstallConfirm(false);
    setReinstallStep(1);
    setSelectedEggId(null);
  }

  const serverVars = (server?.serverVariables ?? []) as ServerVariable[];

  const egg = server?.egg as { name?: string; dockerImages?: string | null } | undefined;
  let dockerImageOptions: { tag: string; alias: string }[] = [];
  try {
    const parsed = JSON.parse(egg?.dockerImages ?? "{}") as Record<string, string>;
    dockerImageOptions = Object.entries(parsed).map(([alias, tag]) => ({ tag, alias }));
  } catch {}

  const currentImage = server?.image ?? "";

  const eggPickerBody = (
    <div className="px-5 py-4 flex flex-col gap-1.5">
      {planEggs.map((egg) => {
        const selected = selectedEggId === egg.id;
        return (
          <button
            key={egg.id}
            type="button"
            onClick={() => setSelectedEggId(egg.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
              selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30",
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Server className="size-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm font-medium">{egg.name}</span>
            <div className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
              selected ? "border-foreground bg-foreground" : "border-border",
            )}>
              {selected && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  const confirmBody = (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-xs text-destructive/80 leading-relaxed">{t("reinstallDialogDescription")}</p>
      </div>
    </div>
  );

  const reinstallModalContent = planEggs.length > 0 && reinstallStep === 1 ? (
    <>
      <DialogHeader>
        <DialogTitle>{t("selectEggTitle")}</DialogTitle>
        <DialogDescription>{t("selectEggDescription")}</DialogDescription>
      </DialogHeader>
      {eggPickerBody}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={closeReinstall}>{t("cancel")}</Button>
        <Button size="sm" disabled={!selectedEggId} onClick={() => setReinstallStep(2)}>{t("reinstallContinue")}</Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <DialogHeader>
        <DialogTitle>{t("reinstallDialogTitle", { name: server?.name ?? "" })}</DialogTitle>
      </DialogHeader>
      {confirmBody}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => planEggs.length > 0 ? setReinstallStep(1) : closeReinstall()}>
          {t("cancel")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={reinstallMutation.isPending}
          onClick={() => reinstallMutation.mutate({ serverId: id, eggId: selectedEggId ?? undefined })}
        >
          {reinstallMutation.isPending ? t("reinstalling") : t("reinstall")}
        </Button>
      </DialogFooter>
    </>
  );

  const reinstallSheetContent = planEggs.length > 0 && reinstallStep === 1 ? (
    <>
      <SheetHeader>
        <SheetTitle>{t("selectEggTitle")}</SheetTitle>
        <SheetDescription>{t("selectEggDescription")}</SheetDescription>
      </SheetHeader>
      {eggPickerBody}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={closeReinstall}>{t("cancel")}</Button>
        <Button size="sm" disabled={!selectedEggId} onClick={() => setReinstallStep(2)}>{t("reinstallContinue")}</Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <SheetHeader>
        <SheetTitle>{t("reinstallDialogTitle", { name: server?.name ?? "" })}</SheetTitle>
      </SheetHeader>
      {confirmBody}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => planEggs.length > 0 ? setReinstallStep(1) : closeReinstall()}>
          {t("cancel")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={reinstallMutation.isPending}
          onClick={() => reinstallMutation.mutate({ serverId: id, eggId: selectedEggId ?? undefined })}
        >
          {reinstallMutation.isPending ? t("reinstalling") : t("reinstall")}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <SectionCard title={t("generalTitle")} description={t("generalDescription")}>
            <SettingRow label={t("serverNameLabel")} description={t("serverNameDescription")}>
              <div className="flex items-center gap-2">
                <DebouncedInput
                  defaultValue={server?.name ?? ""}
                  onSave={saveServerName}
                  className="w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring transition-colors"
                />
              </div>
            </SettingRow>
            <SettingRow label={t("dockerImageLabel")} description={t("dockerImageDescription")}>
              {dockerImageOptions.length > 1 ? (
                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={currentImage}
                    options={dockerImageOptions.map(({ tag, alias }) => ({ value: tag, label: alias || tag }))}
                    onChange={saveImage}
                    disabled={updateImageMutation.isPending}
                  />
                </div>
              ) : (
                <span className="font-mono text-sm text-muted-foreground max-w-xs truncate">
                  {currentImage || "—"}
                </span>
              )}
            </SettingRow>
          </SectionCard>

          <SectionCard title={t("sftpTitle")} description={t("sftpDescription")}>
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {[
                { label: t("sftpHost"), value: sftp.host, copy: sftp.host },
                { label: t("sftpPort"), value: String(sftp.port), copy: null },
                { label: t("sftpUsername"), value: sftp.username, copy: sftp.username },
              ].map(({ label, value, copy: copyVal }, i) => (
                <div key={label} className={`px-4 py-3 ${i < 2 ? "border-b border-border sm:border-b-0 sm:border-r" : ""}`}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 break-all font-mono text-sm text-foreground">{value}</span>
                    {copyVal && (
                      <button
                        type="button"
                        onClick={() => copy(copyVal)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">{t("sftpConnectHint")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`sftp://${sftp.username}@${sftp.host}:${sftp.port}`, "_self")}
              >
                <ExternalLink />
                {t("sftpConnect")}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title={t("startupTitle")} description={t("startupDescription")}>
            <div className="border-b border-border px-4 py-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("startupCommandLabel")}</p>
              <p className="font-mono text-xs text-foreground/70 leading-relaxed break-all">
                {server?.startup ?? "—"}
              </p>
            </div>
            {serverVars.map((sv) => {
              const isBool = isBoolVariable(sv.variable.rules);
              const currentValue = sv.variableValue ?? sv.variable.defaultValue ?? "0";

              if (isBool) {
                return (
                  <SettingRow
                    key={sv.variable.envVariable}
                    label={sv.variable.name}
                    description={sv.variable.description ?? undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={currentValue === "1"}
                        onChange={(v) => saveVariable(sv.variable.envVariable, v ? "1" : "0")}
                        disabled={
                          !sv.variable.userEditable ||
                          (updateVariableMutation.isPending &&
                            updateVariableMutation.variables?.envVariable === sv.variable.envVariable)
                        }
                      />
                      {!sv.variable.userEditable && (
                        <span className="text-xs text-muted-foreground">{t("readOnly")}</span>
                      )}
                    </div>
                  </SettingRow>
                );
              }

              return (
                <SettingRow
                  key={sv.variable.envVariable}
                  label={sv.variable.name}
                  description={sv.variable.description ?? undefined}
                >
                  <div className="flex items-center gap-2">
                    {sv.variable.userEditable ? (
                      <DebouncedInput
                        defaultValue={currentValue}
                        onSave={(v) => saveVariable(sv.variable.envVariable, v)}
                        placeholder={sv.variable.defaultValue ?? undefined}
                        className="w-36 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring transition-colors"
                      />
                    ) : (
                      <input
                        defaultValue={currentValue}
                        readOnly
                        className="w-36 rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-sm text-foreground outline-none opacity-60 cursor-default"
                      />
                    )}
                    {!sv.variable.userEditable && (
                      <span className="text-xs text-muted-foreground">{t("readOnly")}</span>
                    )}
                  </div>
                </SettingRow>
              );
            })}
          </SectionCard>

          {server?.subscriptionId && (
            <SectionCard title={t("subscriptionTitle")} description={t("subscriptionDescription")}>
              {subscriptionQuery.data ? (() => {
                const sub = subscriptionQuery.data;
                const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
                const expiringSoon = periodEnd ? (periodEnd.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 : false;
                const formatCents = (cents: number) =>
                  new Intl.NumberFormat(undefined, { style: "currency", currency: sub.currency, minimumFractionDigits: 2 }).format(cents / 100);

                const extendDialogBody = (
                  <div className="px-5 py-4 flex flex-col gap-2">
                    {expiringSoon && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 mb-1">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                        <span className="text-xs text-amber-600">{t("subscriptionExtendExpiringSoon")}</span>
                      </div>
                    )}
                    {sub.availablePrices.map((price) => {
                      const selected = extendPriceId === price.id;
                      return (
                        <button
                          key={price.id}
                          type="button"
                          onClick={() => setExtendPriceId(price.id)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                            selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30",
                          )}
                        >
                          <span className="text-sm font-medium">{tBilling(`durations.${price.duration}`)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{formatCents(price.priceCents)}</span>
                            <div className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                              selected ? "border-foreground bg-foreground" : "border-border",
                            )}>
                              {selected && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );

                const extendDialogFooter = (
                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setExtendOpen(false)}>{t("cancel")}</Button>
                    <Button
                      size="sm"
                      disabled={!extendPriceId || extendMutation.isPending}
                      onClick={() => extendPriceId && extendMutation.mutate({ subscriptionId: sub.subscriptionId, priceId: extendPriceId })}
                    >
                      {extendMutation.isPending ? t("subscriptionExtending") : t("subscriptionExtendConfirm")}
                    </Button>
                  </DialogFooter>
                );

                return (
                  <>
                    <SettingRow label={t("subscriptionExpiresLabel")}>
                      <div className="flex items-center gap-2">
                        {expiringSoon && <AlertTriangle className="size-3.5 text-amber-500" />}
                        <span className={cn("text-sm font-medium", expiringSoon ? "text-amber-600" : "text-foreground")}>
                          {periodEnd ? periodEnd.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                        </span>
                      </div>
                    </SettingRow>
                    <SettingRow label={t("subscriptionExtendLabel")} description={t("subscriptionExtendDescription")}>
                      <button
                        type="button"
                        onClick={() => setExtendOpen(true)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {t("subscriptionExtendButton")}
                      </button>
                    </SettingRow>

                    {isMobile ? (
                      <Sheet open={extendOpen} onOpenChange={(open) => { if (!open) setExtendOpen(false); }}>
                        <SheetPopup side="bottom" showCloseButton={false} className="rounded-t-2xl">
                          <SheetHeader>
                            <SheetTitle>{t("subscriptionExtendDialogTitle")}</SheetTitle>
                            <SheetDescription>{t("subscriptionExtendDialogDescription")}</SheetDescription>
                          </SheetHeader>
                          {extendDialogBody}
                          {extendDialogFooter}
                        </SheetPopup>
                      </Sheet>
                    ) : (
                      <Dialog open={extendOpen} onOpenChange={(open) => { if (!open) setExtendOpen(false); }}>
                        <DialogPopup showCloseButton={false} className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>{t("subscriptionExtendDialogTitle")}</DialogTitle>
                            <DialogDescription>{t("subscriptionExtendDialogDescription")}</DialogDescription>
                          </DialogHeader>
                          {extendDialogBody}
                          {extendDialogFooter}
                        </DialogPopup>
                      </Dialog>
                    )}
                  </>
                );
              })() : null}
            </SectionCard>
          )}

          <SectionCard title={t("dangerZoneTitle")} description={t("dangerZoneDescription")}>
            <SettingRow
              label={t("reinstallLabel")}
              description={t("reinstallDescription")}
            >
              <button
                type="button"
                onClick={() => setReinstallConfirm(true)}
                className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                {t("reinstall")}
              </button>
            </SettingRow>
          </SectionCard>

          {isMobile ? (
            <Sheet open={reinstallConfirm} onOpenChange={(open) => { if (!open) closeReinstall(); }}>
              <SheetPopup side="bottom" showCloseButton={false} className="rounded-t-2xl">
                {reinstallSheetContent}
              </SheetPopup>
            </Sheet>
          ) : (
            <Dialog open={reinstallConfirm} onOpenChange={(open) => { if (!open) closeReinstall(); }}>
              <DialogPopup showCloseButton={false} className="max-w-md">
                {reinstallModalContent}
              </DialogPopup>
            </Dialog>
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-[240px]">
          <div className="overflow-y-auto">
            <StatRow icon={Server} label={t("statServerId")}>
              <span className="font-mono text-xs text-muted-foreground break-all">{server?.uuid ?? "—"}</span>
            </StatRow>
            <StatRow icon={Globe} label={t("statNode")}>
              <span className="text-sm font-semibold text-foreground">{node?.name ?? "—"}</span>
            </StatRow>
            <StatRow icon={Server} label={t("statEgg")}>
              <span className="text-sm font-semibold text-foreground">{(server?.egg as { name?: string } | undefined)?.name ?? "—"}</span>
            </StatRow>
            <StatRow icon={Terminal} label={t("statSftpHost")}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{sftp.host}:{sftp.port}</span>
                <button
                  type="button"
                  onClick={() => copy(`${sftp.host}:${sftp.port}`)}
                  className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
