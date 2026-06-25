"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Layers,
  Tag,
  Star,
  Cpu,
  MemoryStick,
  HardDrive,
  Archive,
  Network,
  Database,
  Server,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { cn } from "@struxa/ui/lib/utils";
import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Dialog, DialogPopup } from "@struxa/ui/components/dialog";
import { Sheet, SheetPopup } from "@struxa/ui/components/sheet";
import { useMediaQuery } from "@struxa/ui/hooks/use-media-query";

type Duration = "7day" | "1month" | "3months" | "6months" | "1year";

interface PlanPrice {
  id: string;
  duration: Duration;
  price: number;
}

interface ResourceLimits {
  cpu: number;
  ram: number;
  disk: number;
  backups: number;
  allocations: number;
  databases: number;
  eggs: string[];
}

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return price.toFixed(2);
  }
}

const DURATION_ORDER: Duration[] = [
  "7day",
  "1month",
  "3months",
  "6months",
  "1year",
];

function PurchaseDialog({
  open,
  onClose,
  planId,
  planName,
  planDescription,
  planIconUrl,
  resources,
  prices,
  currency,
  walletBalanceCents,
  onPurchase,
  isPurchasing,
}: {
  open: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  planDescription: string;
  planIconUrl: string;
  resources: ResourceLimits;
  prices: PlanPrice[];
  currency: string;
  walletBalanceCents: number;
  onPurchase: (
    priceId: string,
    eggId: string,
    serverName: string,
    dockerImage: string,
    envVars: Record<string, string>,
  ) => void;
  isPurchasing: boolean;
}) {
  const t = useTranslations("panel.billing");
  const d = useTranslations("panel.billing.purchaseDialog");

  const sortedPrices = [...prices].sort(
    (a, b) =>
      DURATION_ORDER.indexOf(a.duration) - DURATION_ORDER.indexOf(b.duration),
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPriceId, setSelectedPriceId] = useState<string>(
    sortedPrices[0]?.id ?? "",
  );
  const [selectedEggId, setSelectedEggId] = useState<string>("");
  const [selectedDockerImage, setSelectedDockerImage] = useState<string>("");
  const [envVarValues, setEnvVarValues] = useState<Record<string, string>>({});
  const [serverName, setServerName] = useState("");
  const [showAllImages, setShowAllImages] = useState(false);

  const isMobile = useMediaQuery("max-sm");

  const { data: planEggs = [], isLoading: eggsLoading } = useQuery({
    ...orpc.billing.listPlanEggs.queryOptions({ input: { planId } }),
    enabled: open && !!planId,
  });

  const selectedPrice = sortedPrices.find((p) => p.id === selectedPriceId);
  const selectedEgg = planEggs.find((e) => e.id === selectedEggId);
  const canAfford =
    walletBalanceCents >= (selectedPrice ? selectedPrice.price * 100 : 0);

  function handleClose() {
    if (isPurchasing) return;
    setStep(1);
    setSelectedEggId("");
    setSelectedDockerImage("");
    setEnvVarValues({});
    setServerName("");
    onClose();
  }

  function handleSelectEgg(egg: (typeof planEggs)[0]) {
    setSelectedEggId(egg.id);
    setSelectedDockerImage(egg.dockerImages[0]?.image ?? "");
    setShowAllImages(false);
    const defaults: Record<string, string> = {};
    for (const v of egg.variables) {
      if (v.userEditable) defaults[v.envVariable] = v.defaultValue ?? "";
    }
    setEnvVarValues(defaults);
  }

  function handleDeploy() {
    if (!selectedPriceId || !selectedEggId || !serverName.trim() || !canAfford)
      return;
    onPurchase(
      selectedPriceId,
      selectedEggId,
      serverName.trim(),
      selectedDockerImage,
      envVarValues,
    );
  }

  const specs = [
    { icon: Cpu, value: resources.cpu, unit: t("specs.cpu") },
    { icon: MemoryStick, value: resources.ram, unit: t("specs.ram") },
    { icon: HardDrive, value: resources.disk, unit: t("specs.disk") },
    { icon: Archive, value: resources.backups, unit: t("specs.backups") },
    {
      icon: Network,
      value: resources.allocations,
      unit: t("specs.allocations"),
    },
    { icon: Database, value: resources.databases, unit: t("specs.databases") },
  ];

  const steps = [
    d("stepDuration"),
    d("stepInstaller"),
    d("stepConfig"),
    d("stepConfirm"),
  ];

  const breadcrumb = (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const done = step > n;
        const active = step === n;
        return (
          <div key={i} className="flex items-center gap-1 min-w-0">
            <div
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                active && "bg-foreground text-background",
                done && "bg-foreground/20 text-foreground",
                !active && !done && "bg-muted text-muted-foreground/40",
              )}
            >
              {done ? <Check className="size-2.5" /> : n}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-foreground" : "text-muted-foreground/40",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/25 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );

  const stepContent = (
    <>
      {step === 1 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground">
              {d("stepDuration")}
            </p>
            <div className="flex flex-col gap-1.5">
              {sortedPrices.map((p) => {
                const affordable = walletBalanceCents >= p.price * 100;
                const selected = selectedPriceId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!affordable}
                    onClick={() => setSelectedPriceId(p.id)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                      selected
                        ? "border-foreground bg-foreground/5 shadow-sm"
                        : "border-border hover:border-foreground/30",
                      !affordable && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {t(`durations.${p.duration}`)}
                      </p>
                      {!affordable && (
                        <p className="text-[10px] text-destructive mt-0.5">
                          {t("topUpRequired")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums">
                        {formatPrice(p.price, currency)}
                      </span>
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                          selected
                            ? "border-foreground bg-foreground"
                            : "border-border",
                        )}
                      >
                        {selected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-background" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {!canAfford && selectedPrice && (
            <p className="text-center text-xs">
              <Link
                href={"/billing/wallet" as never}
                className="text-destructive underline"
                onClick={handleClose}
              >
                {t("topUpRequired")}
              </Link>
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              disabled={!selectedPriceId || !canAfford}
              onClick={() => setStep(2)}
            >
              {d("next")} <ChevronRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground">
              {d("stepInstaller")}
            </p>
            {eggsLoading ? (
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-xl border border-border bg-muted/30"
                  />
                ))}
              </div>
            ) : planEggs.length === 0 ? (
              <div className="py-6 text-center">
                <Server className="mx-auto mb-2 size-7 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  {d("noInstallers")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {planEggs.map((egg) => {
                  const selected = selectedEggId === egg.id;
                  return (
                    <button
                      key={egg.id}
                      type="button"
                      onClick={() => handleSelectEgg(egg)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        selected
                          ? "border-foreground bg-foreground/5 shadow-sm"
                          : "border-border hover:border-foreground/30",
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Server className="size-3.5 text-muted-foreground" />
                      </div>
                      <span className="flex-1 text-sm font-medium">
                        {egg.name}
                      </span>
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                          selected
                            ? "border-foreground bg-foreground"
                            : "border-border",
                        )}
                      >
                        {selected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-background" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-between pt-1">
            <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 size-3.5" /> {d("back")}
            </Button>
            <Button
              size="sm"
              disabled={!selectedEggId}
              onClick={() => setStep(3)}
            >
              {d("next")} <ChevronRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {selectedEgg && selectedEgg.dockerImages.length > 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-foreground">
                {d("dockerImage")}
              </p>
              <div className="flex flex-col gap-1.5">
                {(showAllImages
                  ? selectedEgg.dockerImages
                  : selectedEgg.dockerImages.slice(0, 2)
                ).map((img) => {
                  const selected = selectedDockerImage === img.image;
                  return (
                    <button
                      key={img.image}
                      type="button"
                      onClick={() => setSelectedDockerImage(img.image)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        selected
                          ? "border-foreground bg-foreground/5 shadow-sm"
                          : "border-border hover:border-foreground/30",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{img.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {img.image}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border transition-colors shrink-0",
                          selected
                            ? "border-foreground bg-foreground"
                            : "border-border",
                        )}
                      >
                        {selected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-background" />
                        )}
                      </div>
                    </button>
                  );
                })}
                {selectedEgg.dockerImages.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllImages((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-center"
                  >
                    {showAllImages
                      ? d("showLess")
                      : d("showMore", {
                          count: selectedEgg.dockerImages.length - 2,
                        })}
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedEgg &&
            selectedEgg.variables.filter((v) => v.userEditable).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-foreground">
                  {d("envVars")}
                </p>
                <div className="flex flex-col gap-3">
                  {selectedEgg.variables
                    .filter((v) => v.userEditable)
                    .map((v) => (
                      <div key={v.id} className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-foreground">
                          {v.name}
                        </label>
                        {v.description && (
                          <p className="text-[10px] text-muted-foreground">
                            {v.description}
                          </p>
                        )}
                        <Input
                          value={
                            envVarValues[v.envVariable] ?? v.defaultValue ?? ""
                          }
                          onChange={(e) =>
                            setEnvVarValues((prev) => ({
                              ...prev,
                              [v.envVariable]: e.target.value,
                            }))
                          }
                          placeholder={v.defaultValue ?? v.envVariable}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

          {selectedEgg &&
            selectedEgg.dockerImages.length <= 1 &&
            selectedEgg.variables.filter((v) => v.userEditable).length ===
              0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">{d("noConfig")}</p>
              </div>
            )}

          <div className="flex justify-between pt-1">
            <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 size-3.5" /> {d("back")}
            </Button>
            <Button size="sm" onClick={() => setStep(4)}>
              {d("next")} <ChevronRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground">
              {d("serverName")}
            </p>
            <Input
              placeholder={d("serverNamePlaceholder")}
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && serverName.trim() && canAfford)
                  handleDeploy();
              }}
              maxLength={255}
              autoFocus
            />
          </div>

          {isMobile && (
            <div className="rounded-xl border border-border/60 overflow-hidden text-xs">
              <div className="flex justify-between px-3 py-2 border-b border-border/60">
                <span className="text-muted-foreground">
                  {d("summaryDuration")}
                </span>
                <span className="font-medium">
                  {selectedPrice
                    ? t(`durations.${selectedPrice.duration}`)
                    : "—"}
                </span>
              </div>
              {selectedEgg && (
                <div className="flex justify-between px-3 py-2 border-b border-border/60">
                  <span className="text-muted-foreground">
                    {d("summaryInstaller")}
                  </span>
                  <span className="font-medium">{selectedEgg.name}</span>
                </div>
              )}
              {selectedEgg &&
                selectedEgg.dockerImages.length > 1 &&
                selectedDockerImage && (
                  <div className="flex justify-between px-3 py-2 border-b border-border/60">
                    <span className="text-muted-foreground">
                      {d("summaryImage")}
                    </span>
                    <span className="font-medium">
                      {selectedEgg.dockerImages.find(
                        (i) => i.image === selectedDockerImage,
                      )?.name ?? selectedDockerImage}
                    </span>
                  </div>
                )}
              <div className="flex justify-between px-3 py-2.5 bg-muted/30">
                <span className="font-medium text-foreground">
                  {d("summaryTotal")}
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {selectedPrice
                    ? formatPrice(selectedPrice.price, currency)
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {!canAfford && selectedPrice && (
            <p className="text-center text-xs">
              <Link
                href={"/billing/wallet" as never}
                className="text-destructive underline"
                onClick={handleClose}
              >
                {t("topUpRequired")}
              </Link>
            </p>
          )}

          <div className="flex justify-between pt-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={isPurchasing}
              onClick={() => setStep(3)}
            >
              <ChevronLeft className="mr-1 size-3.5" /> {d("back")}
            </Button>
            <Button
              size="sm"
              disabled={isPurchasing || !serverName.trim() || !canAfford}
              onClick={handleDeploy}
            >
              {isPurchasing ? d("deploying") : d("deploy")}
            </Button>
          </div>
        </>
      )}
    </>
  );

  const desktopContent = (
    <div className="grid grid-cols-[280px_1fr] h-[85vh] overflow-hidden">
      <div className="flex flex-col gap-5 p-6 bg-muted/30 border-r border-border overflow-y-auto min-h-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {planIconUrl ? (
              <img
                src={planIconUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Tag className="size-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{planName}</p>
            {planDescription && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                {planDescription}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <s.icon className="size-3.5 shrink-0 text-muted-foreground/50" />
              <span className="font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span className="text-muted-foreground">{s.unit}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {d("summaryDuration")}
            </span>
            <span className="font-medium text-foreground">
              {selectedPrice ? t(`durations.${selectedPrice.duration}`) : "—"}
            </span>
          </div>
          {selectedEgg && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {d("summaryInstaller")}
              </span>
              <span className="font-medium text-foreground">
                {selectedEgg.name}
              </span>
            </div>
          )}
          {selectedEgg &&
            selectedEgg.dockerImages.length > 1 &&
            selectedDockerImage && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {d("summaryImage")}
                </span>
                <span className="font-medium text-foreground">
                  {selectedEgg.dockerImages.find(
                    (i) => i.image === selectedDockerImage,
                  )?.name ?? selectedDockerImage}
                </span>
              </div>
            )}
          <div className="flex items-baseline justify-between border-t border-border/60 pt-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {d("summaryTotal")}
            </span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {selectedPrice ? formatPrice(selectedPrice.price, currency) : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("walletBalance", {
              balance: formatPrice(walletBalanceCents / 100, currency),
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6 overflow-y-auto min-h-0">
        <p className="text-sm font-semibold text-foreground pr-8">
          {d("title")}
        </p>
        {breadcrumb}
        {stepContent}
      </div>
    </div>
  );

  const mobileContent = (
    <>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {planIconUrl ? (
            <img
              src={planIconUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Tag className="size-3.5 text-muted-foreground/50" />
          )}
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {planName}
        </span>
        {selectedPrice && (
          <span className="shrink-0 text-sm font-bold tabular-nums pr-8">
            {formatPrice(selectedPrice.price, currency)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
        {breadcrumb}
        {stepContent}
      </div>
    </>
  );

  return isMobile ? (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <SheetPopup
        side="bottom"
        showCloseButton={!isPurchasing}
        className="max-h-[92dvh]"
      >
        {mobileContent}
      </SheetPopup>
    </Sheet>
  ) : (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogPopup
        className="w-full max-w-3xl overflow-hidden"
        showCloseButton={!isPurchasing}
      >
        {desktopContent}
      </DialogPopup>
    </Dialog>
  );
}

function PlanCard({
  planId,
  name,
  description,
  iconUrl,
  categoryIconUrl,
  categoryName,
  resources,
  prices,
  isFeatured,
  currency,
  soldOut,
  walletBalanceCents,
  walletLoaded,
  onPurchase,
  isPurchasing,
}: {
  planId: string;
  soldOut: boolean;
  name: string;
  description: string;
  iconUrl: string;
  categoryIconUrl: string;
  categoryName: string;
  resources: ResourceLimits;
  prices: PlanPrice[];
  isFeatured: boolean;
  currency: string;
  walletBalanceCents: number;
  walletLoaded: boolean;
  onPurchase: (
    priceId: string,
    eggId: string,
    serverName: string,
    dockerImage: string,
    envVars: Record<string, string>,
  ) => void;
  isPurchasing: boolean;
}) {
  const t = useTranslations("panel.billing");
  const displayIcon = iconUrl || categoryIconUrl;
  const [dialogOpen, setDialogOpen] = useState(false);

  const sortedPrices = [...prices].sort(
    (a, b) =>
      DURATION_ORDER.indexOf(a.duration) - DURATION_ORDER.indexOf(b.duration),
  );
  const lowestPrice = sortedPrices[0];

  const specs = [
    { icon: Cpu, value: resources.cpu, unit: t("specs.cpu") },
    { icon: MemoryStick, value: resources.ram, unit: t("specs.ram") },
    { icon: HardDrive, value: resources.disk, unit: t("specs.disk") },
    { icon: Archive, value: resources.backups, unit: t("specs.backups") },
    {
      icon: Network,
      value: resources.allocations,
      unit: t("specs.allocations"),
    },
    { icon: Database, value: resources.databases, unit: t("specs.databases") },
  ];

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md",
          isFeatured
            ? "border-primary/40 ring-1 ring-primary/20"
            : "border-border",
        )}
      >
        {isFeatured && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
            <Star className="size-2.5 fill-amber-500" />
            {t("featured")}
          </div>
        )}

        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {displayIcon ? (
              <img
                src={displayIcon}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Tag className="size-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0 flex-1 pr-16">
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
              {categoryName}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
          </div>
        </div>

        {description && (
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        <div className="border-t border-border/60 bg-muted/20 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <s.icon className="size-3.5 shrink-0 text-muted-foreground/50" />
              <span className="font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span className="text-muted-foreground">{s.unit}</span>
            </div>
          ))}
        </div>

        {lowestPrice && (
          <div className="px-4 py-3">
            <p className="text-[10px] text-muted-foreground">
              {t("startingFrom")}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatPrice(lowestPrice.price, currency)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {t(`durations.${lowestPrice.duration}`)}
              </span>
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-border/60 px-4 py-3">
          {soldOut ? (
            <Button size="sm" className="w-full" variant="outline" disabled>
              {t("soldOut")}
            </Button>
          ) : !walletLoaded ? (
            <Button size="sm" className="w-full" disabled>
              {t("getStarted")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={isPurchasing}
              onClick={() => setDialogOpen(true)}
            >
              {t("selectPlan")}
            </Button>
          )}
        </div>
      </div>

      <PurchaseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        planId={planId}
        planName={name}
        planDescription={description}
        planIconUrl={displayIcon}
        resources={resources}
        prices={prices}
        currency={currency}
        walletBalanceCents={walletBalanceCents}
        onPurchase={(priceId, eggId, serverName, dockerImage, envVars) => {
          onPurchase(priceId, eggId, serverName, dockerImage, envVars);
        }}
        isPurchasing={isPurchasing}
      />
    </>
  );
}

export default function BillingCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const t = useTranslations("panel.billing");
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: categories = [], isLoading: catsLoading } = useQuery(
    orpc.billing.listCategories.queryOptions(),
  );

  const category = categories.find((c) => c.slug === slug);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    ...orpc.billing.listProducts.queryOptions({ categoryId: category?.id }),
    enabled: !!category?.id,
  });

  const { data: billingConfig } = useQuery(
    orpc.billing.getConfig.queryOptions(),
  );
  const { data: wallet, isSuccess: walletLoaded } = useQuery(
    orpc.billing.getWallet.queryOptions(),
  );
  const walletBalanceCents = wallet?.balanceCents ?? 0;
  const displayCurrency = billingConfig?.defaultCurrency ?? "USD";

  const purchaseMutation = useMutation(
    orpc.billing.purchasePlan.mutationOptions(),
  );

  function handlePurchase(
    priceId: string,
    eggId: string,
    serverName: string,
    dockerImage: string,
    envVars: Record<string, string>,
  ) {
    purchaseMutation.mutate(
      { priceId, eggId, serverName, dockerImage, envVars },
      {
        onSuccess: (data) => {
          toast.success(t("purchaseSuccess"));
          void queryClient.invalidateQueries({
            queryKey: orpc.billing.getWallet.key(),
          });
          void queryClient.invalidateQueries({
            queryKey: orpc.billing.listSubscriptions.key(),
          });
          router.push(`/servers/${data.serverUuid}` as never);
        },
        onError: (err: unknown) => {
          const code = (err as { data?: { code?: string } })?.data?.code;
          if (code === "INSUFFICIENT_FUNDS")
            toast.error(t("errors.insufficientFunds"));
          else if (code === "CURRENCY_MISMATCH")
            toast.error(t("errors.currencyMismatch"));
          else if (code === "NO_ALLOCATIONS")
            toast.error(t("errors.noAllocations"));
          else if (code === "NO_CAPACITY")
            toast.error(t("errors.noCapacity"));
          else toast.error(t("errors.purchaseFailed"));
        },
      },
    );
  }

  const isLoading = catsLoading || (!!category?.id && productsLoading);

  return (
    <div className="flex-1 overflow-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-5">
        <Link
          href={"/billing" as never}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground w-fit"
        >
          <ChevronLeft className="size-3.5" />
          {t("backToCategories")}
        </Link>

        {catsLoading ? (
          <div className="h-14 animate-pulse rounded-2xl border border-border bg-muted/30" />
        ) : category ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {category.bannerUrl && (
              <div className="relative h-20 overflow-hidden">
                <img
                  src={category.bannerUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/20" />
              </div>
            )}
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                category.bannerUrl && "border-t border-border/60",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {category.icon ? (
                  <img
                    src={category.icon}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Layers className="size-4 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold text-foreground">
                  {category.name}
                </h1>
                {category.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {category.description}
                  </p>
                )}
              </div>
              {walletLoaded && (
                <p className="shrink-0 text-xs text-muted-foreground">
                  {t("walletBalance", {
                    balance: formatPrice(
                      walletBalanceCents / 100,
                      displayCurrency,
                    ),
                  })}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border border-border bg-muted/30"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Tag className="size-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <PlanCard
                key={product.id}
                planId={product.planId}
                name={product.name}
                description={product.description}
                iconUrl={product.icon}
                categoryIconUrl={category?.icon ?? ""}
                categoryName={category?.name ?? ""}
                resources={product.resources}
                prices={product.prices}
                isFeatured={product.isFeatured}
                currency={displayCurrency}
                soldOut={product.soldOut}
                walletBalanceCents={walletBalanceCents}
                walletLoaded={walletLoaded}
                onPurchase={handlePurchase}
                isPurchasing={purchaseMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
