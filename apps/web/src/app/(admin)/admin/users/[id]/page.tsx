"use client";

import { use, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, Server, Shield, ShieldOff, Ban, UserCheck, Monitor, Wallet } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc, queryClient } from "@/utils/orpc";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Tab = "overview" | "servers" | "security" | "billing" | "actions";

function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 40);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{children}</span>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const tBilling = useTranslations("panel.billing");
  const { id: userId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: billingConfig } = useQuery(orpc.billing.getConfig.queryOptions());

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: t("tabOverview") },
    { id: "servers", label: t("tabServers") },
    { id: "security", label: t("tabSecurity") },
    ...(billingConfig?.enabled ? [{ id: "billing" as Tab, label: t("tabBilling") }] : []),
    { id: "actions", label: t("tabActions") },
  ];

  const { data: user, isLoading, refetch } = useQuery(
    orpc.users.adminGet.queryOptions({ input: { userId } }),
  );

  const { data: sessions } = useQuery(
    orpc.users.adminGetSessions.queryOptions({ input: { userId } }),
  );

  const { data: serversData } = useQuery(
    orpc.users.adminGetServers.queryOptions({ input: { userId, page: 1 } }),
  );

  const { data: userWallet } = useQuery({
    ...orpc.billing.adminGetUserWallet.queryOptions({ input: { userId } }),
    enabled: tab === "billing" && (billingConfig?.enabled ?? false),
  });
  const { data: userSubscriptions } = useQuery({
    ...orpc.billing.adminListUserSubscriptions.queryOptions({ input: { userId } }),
    enabled: tab === "billing" && (billingConfig?.enabled ?? false),
  });
  const { data: walletTxns } = useQuery({
    ...orpc.billing.adminListUserWalletTransactions.queryOptions({ input: { userId } }),
    enabled: tab === "billing" && (billingConfig?.enabled ?? false),
  });

  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const adjustBalanceMutation = useMutation(
    orpc.billing.adminAdjustUserBalance.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.billing.adminGetUserWallet.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.billing.adminListUserWalletTransactions.key() });
        setAdjustDialog(false);
        setAdjustAmount("");
        setAdjustNote("");
        toast.success(tc("saved"));
      },
    }),
  );

  function invalidateUser() {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
  }

  const setRoleMutation = useMutation(orpc.users.setRole.mutationOptions({
    onSuccess: () => { invalidateUser(); toast.success(tc("updated")); },
  }));
  const banMutation = useMutation(orpc.users.ban.mutationOptions({
    onSuccess: () => { invalidateUser(); toast.success(tc("updated")); },
  }));
  const unbanMutation = useMutation(orpc.users.unban.mutationOptions({
    onSuccess: () => { invalidateUser(); toast.success(tc("updated")); },
  }));
  const deleteMutation = useMutation(
    orpc.users.delete.mutationOptions({
      onSuccess: () => { toast.success(tc("deleted")); router.push("/admin/users" as never); },
    }),
  );

  const [banDialog, setBanDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("detailLoading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("detailNotFound")}
      </div>
    );
  }

  const displayName = user.name ?? user.email;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Dialogs */}
      <Dialog open={banDialog} onOpenChange={(open) => { setBanDialog(open); if (!open) setBanReason(""); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("banDialogTitle", { name: displayName })}</DialogTitle>
            <DialogDescription>{t("banDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              {t("banReasonLabel")} <span className="text-muted-foreground font-normal">{t("banReasonOptional")}</span>
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder={t("banReasonPlaceholder")}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={banMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={banMutation.isPending}
              onClick={async () => {
                await banMutation.mutateAsync({ userId, reason: banReason || undefined });
                setBanDialog(false);
                setBanReason("");
              }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {banMutation.isPending ? t("banning") : t("banUser")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={t("deleteDialogTitle", { name: displayName })}
        description={t("deleteDialogDesc")}
        confirmLabel={t("deleteUser")}
        destructive
        onConfirm={() => deleteMutation.mutate({ userId })}
        loading={deleteMutation.isPending}
      />

      <Dialog open={adjustDialog} onOpenChange={(open) => { setAdjustDialog(open); if (!open) { setAdjustAmount(""); setAdjustNote(""); } }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("billingAdjustTitle")}</DialogTitle>
            <DialogDescription>{t("billingAdjustDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="adjust-amount" className="text-xs font-medium text-foreground">{t("billingAdjustAmountLabel")}</label>
              <input
                id="adjust-amount"
                autoFocus
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("billingAdjustAmountPlaceholder")}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="adjust-note" className="text-xs font-medium text-foreground">{t("billingAdjustNoteLabel")}</label>
              <input
                id="adjust-note"
                type="text"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("billingAdjustNotePlaceholder")}
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={adjustBalanceMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={adjustBalanceMutation.isPending || !adjustAmount || !Number.isFinite(parseFloat(adjustAmount)) || Math.round(parseFloat(adjustAmount) * 100) === 0}
              onClick={() => {
                const amountCents = Math.round(parseFloat(adjustAmount) * 100);
                if (!amountCents || !Number.isFinite(amountCents)) return;
                adjustBalanceMutation.mutate({ userId, amountCents, description: adjustNote || undefined });
              }}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {adjustBalanceMutation.isPending ? tc("saving") : tc("save")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Header breadcrumb */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-4 py-2.5">
        <Link href="/admin/users" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          {t("usersLink")}
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-xs font-medium text-foreground">{displayName}</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((tab_item) => (
          <button
            key={tab_item.id}
            type="button"
            onClick={() => setTab(tab_item.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === tab_item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab_item.label}
            {tab_item.id === "servers" && (serversData?.total ?? 0) > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {serversData!.total}
              </span>
            )}
            {tab_item.id === "actions" && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">!</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }} className="flex flex-col gap-4">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <>
              <SectionCard title={t("identityTitle")}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-foreground">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">{user.name ?? "—"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  <InfoRow label={t("roleLabel")}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.role === "admin" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {user.role ?? "user"}
                    </span>
                  </InfoRow>
                  <InfoRow label={t("statusLabel")}>
                    {user.banned ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">{t("banned")}</span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{t("active")}</span>
                    )}
                  </InfoRow>
                  <InfoRow label={t("twoFactorLabel")}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {user.twoFactorEnabled ? t("tfaEnabled") : t("tfaNotEnabled")}
                    </span>
                  </InfoRow>
                  <InfoRow label={t("joinedLabel")}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                  </InfoRow>
                  <InfoRow label={t("serversLabel")}>
                    <button
                      type="button"
                      onClick={() => setTab("servers")}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {t("serverCountPlural", { count: user.serverCount })}
                    </button>
                  </InfoRow>
                </div>
              </SectionCard>

              {user.banned && user.banReason && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <p className="text-xs font-semibold text-destructive">{t("banReasonTitle")}</p>
                  <p className="mt-1 text-sm text-foreground">{user.banReason}</p>
                  {user.banExpires && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("banExpiresPrefix")} {new Date(user.banExpires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              )}

              <SectionCard title={t("billingTitle")}>
                {user.billingAddressLine1 ? (
                  <div className="flex flex-col divide-y divide-border">
                    {user.billingName && <InfoRow label="Name">{user.billingName}</InfoRow>}
                    <InfoRow label={t("addressLabel")}>{user.billingAddressLine1}{user.billingAddressLine2 ? `, ${user.billingAddressLine2}` : ""}</InfoRow>
                    <InfoRow label={t("cityStateLabel")}>{[user.billingCity, user.billingState].filter(Boolean).join(", ")}</InfoRow>
                    <InfoRow label={t("postalCodeLabel")}>{user.billingPostalCode ?? "—"}</InfoRow>
                    <InfoRow label={t("countryLabel")}>{user.billingCountry ?? "—"}</InfoRow>
                    {user.vatNumber && <InfoRow label={t("vatLabel")}>{user.vatNumber} ({user.vatCountry})</InfoRow>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noBilling")}</p>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Servers ── */}
          {tab === "servers" && (
            <SectionCard title={t("serversTitle")}>
              {!serversData || serversData.servers.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">{t("noServers")}</div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1fr_120px_100px_90px] border-b border-border bg-muted/40 px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Name</span>
                    <span className="text-xs font-medium text-muted-foreground">Node</span>
                    <span className="text-xs font-medium text-muted-foreground">Allocation</span>
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                  </div>
                  {serversData.servers.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/admin/servers/${s.uuid}` as never}
                      className={`grid grid-cols-[1fr_120px_100px_90px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${i < serversData.servers.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.nodeName ?? "—"}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.allocationIp}:{s.allocationPort}
                      </span>
                      {s.suspended ? (
                        <span className="w-fit rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">{t("suspendedStatus")}</span>
                      ) : (
                        <span className="w-fit rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">{t("activeStatus")}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <>
              <SectionCard title={t("tfaTitle")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{t("tfaTotp")}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {user.twoFactorEnabled ? t("tfaEnabled") : t("tfaNotEnabled")}
                  </span>
                </div>
              </SectionCard>

              <SectionCard title={t("sessionsTitle")}>
                {!sessions || sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{parseUserAgent(s.userAgent)}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.ipAddress ?? "Unknown IP"} · Signed in {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${new Date(s.expiresAt) > new Date() ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {new Date(s.expiresAt) > new Date() ? t("sessionActive") : t("sessionExpired")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Billing ── */}
          {tab === "billing" && (
            <>
              <SectionCard title={t("billingWalletTitle")}>
                <div className="flex flex-col divide-y divide-border">
                  <InfoRow label={t("billingBalanceLabel")}>
                    <span className="font-semibold text-foreground">
                      {userWallet
                        ? (userWallet.balanceCents / 100).toLocaleString("en-US", { style: "currency", currency: userWallet.currency })
                        : "—"}
                    </span>
                  </InfoRow>
                  <InfoRow label={t("billingCurrencyLabel")}>
                    {userWallet?.currency ?? "—"}
                  </InfoRow>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAdjustDialog(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {t("billingAdjustButton")}
                  </button>
                </div>
              </SectionCard>

              <SectionCard title={t("billingActiveSubsTitle")}>
                {!userSubscriptions || userSubscriptions.filter((s) => s.status !== "canceled").length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("billingNoActiveSubs")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {userSubscriptions.filter((s) => s.status !== "canceled").map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.productName} — {s.planName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {(s.priceCents / 100).toLocaleString("en-US", { style: "currency", currency: s.currency })} / {tBilling(`durations.${s.duration}`)}
                            {s.currentPeriodEnd && (
                              <> · {t("billingSubRenews")} {new Date(s.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                            )}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          s.status === "active" ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : s.status === "trialing" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {s.status === "active" ? t("billingStatusActive") : s.status === "trialing" ? t("billingStatusTrialing") : t("billingStatusPastDue")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t("billingSubHistoryTitle")}>
                {!userSubscriptions || userSubscriptions.filter((s) => s.status === "canceled").length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("billingNoSubHistory")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {userSubscriptions.filter((s) => s.status === "canceled").map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <p className="text-sm text-foreground">{s.productName} — {s.planName}</p>
                        <span className="text-xs text-muted-foreground">
                          {t("billingSubCanceledAt")} {s.canceledAt ? new Date(s.canceledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t("billingWalletTxnsTitle")}>
                {!walletTxns || walletTxns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("billingNoWalletTxns")}</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[80px_90px_90px_1fr_100px] border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                      <span>{t("billingTxnTypeCol")}</span>
                      <span>{t("billingTxnAmountCol")}</span>
                      <span>{t("billingTxnBalanceCol")}</span>
                      <span>{t("billingTxnNoteCol")}</span>
                      <span>{t("billingTxnDateCol")}</span>
                    </div>
                    {walletTxns.map((txn, i) => (
                      <div
                        key={txn.id}
                        className={`grid grid-cols-[80px_90px_90px_1fr_100px] items-center px-4 py-3 text-xs ${i < walletTxns.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <span className={`w-fit rounded-full px-2 py-0.5 font-medium ${
                          txn.type === "topup" ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : txn.type === "charge" ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : txn.type === "refund" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {tBilling(`wallet.types.${txn.type}` as Parameters<typeof tBilling>[0])}
                        </span>
                        <span className={txn.amountCents >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {txn.amountCents >= 0 ? "+" : ""}
                          {(txn.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: txn.currency })}
                        </span>
                        <span className="text-foreground">
                          {(txn.balanceAfterCents / 100).toLocaleString("en-US", { style: "currency", currency: txn.currency })}
                        </span>
                        <span className="truncate text-muted-foreground">{txn.description ?? "—"}</span>
                        <span className="text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Admin Actions ── */}
          {tab === "actions" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-destructive/60">{t("actionsTitle")}</p>
              <div className="flex flex-col gap-3">

                {/* Role */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.role === "admin" ? t("demoteTitle") : t("promoteTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.role === "admin" ? t("demoteDesc") : t("promoteDesc")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={setRoleMutation.isPending}
                    onClick={() => setRoleMutation.mutate({ userId, role: user.role === "admin" ? "user" : "admin" })}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40 ${
                      user.role === "admin"
                        ? "border border-border text-muted-foreground hover:bg-muted"
                        : "bg-foreground text-background hover:opacity-80"
                    }`}
                  >
                    {user.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {setRoleMutation.isPending ? "…" : user.role === "admin" ? t("demote") : t("promote")}
                  </button>
                </div>

                {/* Ban / Unban */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.banned ? t("unbanTitle") : t("banActionTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.banned ? t("unbanDesc") : t("banActionDesc")}
                    </p>
                    {user.banned && user.banReason && (
                      <p className="mt-1 text-xs text-destructive/80">{t("banReasonPrefix")} {user.banReason}</p>
                    )}
                  </div>
                  {user.banned ? (
                    <button
                      type="button"
                      disabled={unbanMutation.isPending}
                      onClick={() => unbanMutation.mutate({ userId })}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {unbanMutation.isPending ? "…" : t("unban")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBanDialog(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {t("ban")}
                    </button>
                  )}
                </div>

                {/* Delete */}
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("deleteUserTitle")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("deleteUserDesc")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteDialog(true)}
                    className="rounded-lg border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    {tc("delete")}
                  </button>
                </div>
              </div>
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </>
  );
}
