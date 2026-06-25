"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight, ArrowDownLeft, RotateCcw,
  SlidersHorizontal, Clock, CreditCard, Banknote,
  Wallet, ChevronLeft, ChevronRight, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { cn } from "@struxa/ui/lib/utils";
import { Button } from "@struxa/ui/components/button";
import { useMediaQuery } from "@struxa/ui/hooks/use-media-query";
import { Input } from "@struxa/ui/components/input";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@struxa/ui/components/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@struxa/ui/components/sheet";

type TxType = "topup" | "refund" | "charge" | "adjustment" | "expired";

function formatBalance(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

function formatAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  } catch {
    return (Math.abs(cents) / 100).toFixed(2);
  }
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

const TYPE_ICON: Record<TxType, React.ElementType> = {
  topup: ArrowUpRight,
  refund: RotateCcw,
  charge: ArrowDownLeft,
  adjustment: SlidersHorizontal,
  expired: Clock,
};

const TYPE_POSITIVE: Record<TxType, boolean> = {
  topup: true,
  refund: true,
  charge: false,
  adjustment: false,
  expired: false,
};

const PROVIDER_ICON: Record<string, React.ElementType> = {
  stripe: CreditCard,
  simpay: Banknote,
};

const PRESET_AMOUNTS = [5, 10, 25, 50];


function TopUpForm({
  currency,
  isPending,
  onSubmit,
}: {
  currency: string;
  isPending: boolean;
  onSubmit: (amountCents: number) => void;
}) {
  const t = useTranslations("panel.billing.wallet");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const resolvedAmount = selectedPreset ?? (customAmount ? parseFloat(customAmount) : null);

  function handleSubmit() {
    if (!resolvedAmount || !Number.isFinite(resolvedAmount) || resolvedAmount < 1) return;
    onSubmit(Math.round(resolvedAmount * 100));
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="grid grid-cols-2 gap-2">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => { setSelectedPreset(amount); setCustomAmount(""); }}
            className={cn(
              "rounded-xl border py-2.5 text-sm font-medium transition-all",
              selectedPreset === amount
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {formatBalance(amount * 100, currency)}
          </button>
        ))}
      </div>

      <Input
        type="number"
        min="1"
        step="0.01"
        placeholder={t("topUpSheet.customAmountPlaceholder")}
        value={customAmount}
        onChange={(e) => { setCustomAmount(e.target.value); setSelectedPreset(null); }}
      />

      <Button
        className="w-full"
        disabled={!resolvedAmount || !Number.isFinite(resolvedAmount) || resolvedAmount < 1 || isPending}
        onClick={handleSubmit}
      >
        {isPending ? t("topUpSheet.processing") : t("topUpSheet.confirm")}
      </Button>
    </div>
  );
}

const DURATION_KEYS = new Set(["7day", "1month", "3months", "6months", "1year"]);
const TX_DESC_KEYS = new Set(["referral_bonus", "referral_commission"]);

export default function WalletPage() {
  const t = useTranslations("panel.billing.wallet");
  const tBilling = useTranslations("panel.billing");
  const tr = useTranslations("panel.billing.wallet.referral");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("max-sm");
  const [open, setOpen] = useState(false);
  const [topupStep, setTopupStep] = useState<"provider" | "amount">("provider");
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);
  const successHandled = useRef(false);

  const [inputCode, setInputCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [editingCode, setEditingCode] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [txPage, setTxPage] = useState(0);
  const queryClient = useQueryClient();

  const TX_PAGE_SIZE = 10;

  const { data: wallet, refetch: refetchWallet } = useQuery(orpc.billing.getWallet.queryOptions());
  const { data: txRaw = [], isLoading: txLoading, refetch: refetchTransactions } = useQuery(
    orpc.billing.listWalletTransactions.queryOptions({ limit: TX_PAGE_SIZE + 1, offset: txPage * TX_PAGE_SIZE }),
  );
  const hasNextPage = txRaw.length > TX_PAGE_SIZE;
  const transactions = txRaw.slice(0, TX_PAGE_SIZE);
  const { data: gateways = [] } = useQuery(orpc.billing.listActiveGateways.queryOptions());
  const { data: billingConfig } = useQuery(orpc.billing.getConfig.queryOptions());
  const { data: referralCode } = useQuery({
    ...orpc.billing.getReferralCode.queryOptions(),
    enabled: !!billingConfig?.referralEnabled,
  });

  const generateCodeMutation = useMutation({
    ...orpc.billing.generateReferralCode.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.billing.getReferralCode.key() });
      setNewCode("");
    },
    onError: (err: Error) => {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "CODE_TAKEN") toast.error(tr("errorCodeTaken"));
      else toast.error(tr("errorGeneric"));
    },
  });

  const updateCodeMutation = useMutation({
    ...orpc.billing.updateReferralCode.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.billing.getReferralCode.key() });
      setEditingCode(false);
      setEditCode("");
    },
    onError: (err: Error) => {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "CODE_TAKEN") toast.error(tr("errorCodeTaken"));
      else toast.error(tr("errorGeneric"));
    },
  });

  const applyCodeMutation = useMutation({
    ...orpc.billing.applyReferralCode.mutationOptions(),
    onSuccess: () => {
      toast.success(tr("applySuccess"));
      setInputCode("");
    },
    onError: (err: Error) => {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "SELF_REFERRAL") toast.error(tr("errorSelfReferral"));
      else if (code === "ALREADY_APPLIED") toast.error(tr("errorAlreadyApplied"));
      else if (code === "CODE_NOT_FOUND") toast.error(tr("errorCodeNotFound"));
      else toast.error(tr("errorGeneric"));
    },
  });

  const topupMutation = useMutation({
    ...orpc.billing.createTopupSession.mutationOptions(),
    onSuccess: ({ url }) => {
      router.push(url as never);
    },
    onError: () => {
      toast.error(t("topUpError"));
    },
  });

  useEffect(() => {
    if (searchParams.get("topup") === "success" && !successHandled.current) {
      successHandled.current = true;
      toast.success(t("topUpSuccess"));
      void refetchWallet();
      void refetchTransactions();
      const url = new URL(window.location.href);
      url.searchParams.delete("topup");
      router.replace((url.pathname + (url.search || "")) as never);
    }
  }, [searchParams, t, refetchWallet, refetchTransactions, router]);

  const currency = wallet?.currency ?? "USD";

  function openTopup() {
    if (gateways.length === 0) {
      toast.error(t("noGateway"));
      return;
    }
    if (gateways.length === 1) {
      setSelectedGatewayId(gateways[0]!.id);
      setTopupStep("amount");
    } else {
      setSelectedGatewayId(null);
      setTopupStep("provider");
    }
    setOpen(true);
  }

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setSelectedGatewayId(null);
      setTopupStep("provider");
    }
  }

  function handleTopup(amountCents: number) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    topupMutation.mutate({
      gatewayId: selectedGatewayId!,
      amountCents,
      successUrl: `${base}/billing/wallet?topup=success`,
      cancelUrl: `${base}/billing/wallet`,
    });
  }

  function applyCode() {
    if (!inputCode.trim()) return;
    applyCodeMutation.mutate({ code: inputCode.trim() });
  }

  const isProviderStep = topupStep === "provider";
  const modalTitle = isProviderStep ? t("chooseProvider") : t("topUpSheet.title");
  const modalDesc = isProviderStep ? t("chooseProviderDesc") : t("topUpSheet.description");

  const BANNER_PROVIDERS = ["stripe", "simpay"];

  const modalContent = isProviderStep ? (
    <div className="flex flex-col gap-2 p-5">
      {gateways.map((gw) => {
        const hasBanner = BANNER_PROVIDERS.includes(gw.provider);
        const Icon = PROVIDER_ICON[gw.provider] ?? Wallet;
        return (
          <button
            key={gw.id}
            type="button"
            onClick={() => { setSelectedGatewayId(gw.id); setTopupStep("amount"); }}
            className="overflow-hidden rounded-xl border border-border transition-all hover:border-foreground/40 hover:bg-muted/30"
          >
            {hasBanner ? (
              <div className="flex items-center justify-center px-4 py-3">
                <img
                  src={`/providers/${gw.provider}-long.png`}
                  alt={gw.name}
                  className="h-7 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 text-left">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{gw.name}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  ) : (
    <>
      {gateways.length > 1 && (
        <button
          type="button"
          onClick={() => setTopupStep("provider")}
          className="flex items-center gap-1 px-5 pt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-3" />
          {t("back")}
        </button>
      )}
      <TopUpForm currency={currency} isPending={topupMutation.isPending} onSubmit={handleTopup} />
    </>
  );

  return (
    <div className="flex-1 overflow-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">

        {/* Balance card */}
        <div className="rounded-2xl border border-border bg-card px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p className="text-4xl font-bold tabular-nums text-foreground leading-none">
              {wallet ? formatBalance(wallet.balanceCents, currency) : "—"}
            </p>
          </div>
          <Button onClick={openTopup} size="sm">
            {t("topUp")}
          </Button>
        </div>

        {/* Transaction history */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t("transactions")}</h2>

          {txLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-muted/30" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Wallet className="size-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
              <p className="text-xs text-muted-foreground/60">{t("noTransactionsHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border/60">
              {transactions.map((tx) => {
                const Icon = TYPE_ICON[tx.type as TxType] ?? ArrowUpRight;
                const isPositive = tx.type === "adjustment" ? tx.amountCents > 0 : (TYPE_POSITIVE[tx.type as TxType] ?? false);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500",
                    )}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t(`types.${tx.type as TxType}`)}
                        {tx.description && (() => {
                          const desc = tx.description;
                          if (TX_DESC_KEYS.has(desc)) {
                            return <span className="ml-1.5 font-normal text-muted-foreground">— {t(`txDescriptions.${desc}`)}</span>;
                          }
                          const sep = desc.lastIndexOf(" — ");
                          if (sep !== -1) {
                            const suffix = desc.slice(sep + 3);
                            if (DURATION_KEYS.has(suffix)) {
                              return <span className="ml-1.5 font-normal text-muted-foreground">— {desc.slice(0, sep)} — {tBilling(`durations.${suffix}`)}</span>;
                            }
                          }
                          return <span className="ml-1.5 font-normal text-muted-foreground">— {desc}</span>;
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-semibold tabular-nums", isPositive ? "text-emerald-500" : "text-red-500")}>
                        {isPositive ? "+" : "−"}{formatAmount(tx.amountCents, tx.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatBalance(tx.balanceAfterCents, tx.currency)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(txPage > 0 || hasNextPage) && !txLoading && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setTxPage((p) => p - 1)}
                disabled={txPage === 0}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
                {tc("prev")}
              </button>
              <span className="text-xs text-muted-foreground">{tc("page", { page: txPage + 1 })}</span>
              <button
                type="button"
                onClick={() => setTxPage((p) => p + 1)}
                disabled={!hasNextPage}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                {tc("next")}
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Referral program */}
        {billingConfig?.referralEnabled && <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{tr("title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{tr("subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Your referral code */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">{tr("yourCode")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tr("yourCodeDesc")}</p>
              </div>
              {referralCode ? (
                <div className="flex flex-col gap-2">
                  {editingCode ? (
                    <div className="flex gap-2">
                      <Input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                        placeholder={referralCode.code}
                        className="font-mono text-xs h-8"
                        maxLength={30}
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateCodeMutation.mutate({ code: editCode })}
                        disabled={editCode.length < 3 || updateCodeMutation.isPending}
                        className="shrink-0 h-8"
                      >
                        {tr("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingCode(false); setEditCode(""); }}
                        className="shrink-0 h-8"
                      >
                        {tr("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={referralCode.code}
                        className="font-mono text-xs h-8 bg-muted/40"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={tr("editCode")}
                        onClick={() => { setEditCode(referralCode.code); setEditingCode(true); }}
                        className="shrink-0 h-8 w-8"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">{tr("usageCount", { count: referralCode.usageCount })}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                    placeholder={tr("codePlaceholderCreate")}
                    className="font-mono text-xs h-8"
                    maxLength={30}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => generateCodeMutation.mutate({ code: newCode })}
                    disabled={newCode.length < 3 || generateCodeMutation.isPending}
                    className="shrink-0 h-8"
                  >
                    {tr("create")}
                  </Button>
                </div>
              )}
            </div>

            {/* Apply a code */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">{tr("enterCode")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tr("enterCodeDesc")}</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder={tr("codePlaceholder")}
                  className="text-xs h-8 font-mono"
                  disabled={applyCodeMutation.isPending}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={applyCode}
                  disabled={!inputCode.trim() || applyCodeMutation.isPending}
                  className="shrink-0 h-8"
                >
                  {tr("apply")}
                </Button>
              </div>
            </div>
          </div>
        </div>}

      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={handleClose}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{modalTitle}</SheetTitle>
              <SheetDescription>{modalDesc}</SheetDescription>
            </SheetHeader>
            {modalContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogPopup className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription>{modalDesc}</DialogDescription>
            </DialogHeader>
            {modalContent}
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
