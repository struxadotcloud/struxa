"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  Layers,
  Tag,
  Star,
  Cpu,
  MemoryStick,
  HardDrive,
  Archive,
  Network,
  Database,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { cn } from "@struxa/ui/lib/utils";
import { Button } from "@struxa/ui/components/button";

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

function PlanCard({
  name,
  description,
  iconUrl,
  categoryIconUrl,
  categoryName,
  resources,
  prices,
  isFeatured,
  currency,
}: {
  name: string;
  description: string;
  iconUrl: string;
  categoryIconUrl: string;
  categoryName: string;
  resources: ResourceLimits;
  prices: PlanPrice[];
  isFeatured: boolean;
  currency: string;
}) {
  const t = useTranslations("panel.billing");
  const displayIcon = iconUrl || categoryIconUrl;

  const DURATION_ORDER: Duration[] = ["7day", "1month", "3months", "6months", "1year"];
  const sortedPrices = [...prices].sort(
    (a, b) => DURATION_ORDER.indexOf(a.duration) - DURATION_ORDER.indexOf(b.duration),
  );
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(
    sortedPrices[0]?.duration ?? null,
  );

  const selectedPrice = sortedPrices.find((p) => p.duration === selectedDuration);

  const specs = [
    { icon: Cpu, value: resources.cpu, unit: t("specs.cpu") },
    { icon: MemoryStick, value: resources.ram, unit: t("specs.ram") },
    { icon: HardDrive, value: resources.disk, unit: t("specs.disk") },
    { icon: Archive, value: resources.backups, unit: t("specs.backups") },
    { icon: Network, value: resources.allocations, unit: t("specs.allocations") },
    { icon: Database, value: resources.databases, unit: t("specs.databases") },
  ];

  return (
    <div className={cn(
      "relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md",
      isFeatured ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
    )}>
      {isFeatured && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
          <Star className="size-2.5 fill-amber-500" />
          {t("featured")}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {displayIcon
            ? <img src={displayIcon} alt="" className="h-full w-full object-cover" />
            : <Tag className="size-4 text-muted-foreground/50" />
          }
        </div>
        <div className="min-w-0 flex-1 pr-16">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">{categoryName}</p>
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        </div>
      </div>

      {description && (
        <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
      )}

      <div className="border-t border-border/60 bg-muted/20 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
        {specs.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <s.icon className="size-3.5 shrink-0 text-muted-foreground/50" />
            <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
            <span className="text-muted-foreground">{s.unit}</span>
          </div>
        ))}
      </div>

      {sortedPrices.length > 0 && (
        <div className="px-4 py-3 flex flex-col gap-3">
          {sortedPrices.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {sortedPrices.map((p) => (
                <button
                  key={p.duration}
                  type="button"
                  onClick={() => setSelectedDuration(p.duration)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                    selectedDuration === p.duration
                      ? "bg-foreground text-background"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t(`durations.${p.duration}`)}
                </button>
              ))}
            </div>
          )}

          {selectedPrice && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {formatPrice(selectedPrice.price, currency)}
              </span>
              <span className="text-xs text-muted-foreground">
                / {t(`durations.${selectedPrice.duration}`)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-border/60 px-4 py-3">
        <Button size="sm" className="w-full" disabled>
          {t("getStarted")}
        </Button>
      </div>
    </div>
  );
}

export default function BillingCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const t = useTranslations("panel.billing");

  const { data: categories = [], isLoading: catsLoading } = useQuery(
    orpc.billing.listCategories.queryOptions(),
  );

  const category = categories.find((c) => c.slug === slug);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    ...orpc.billing.listProducts.queryOptions({ categoryId: category?.id }),
    enabled: !!category?.id,
  });

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
                <img src={category.bannerUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/20" />
              </div>
            )}
            <div className={cn(
              "flex items-center gap-3 px-4 py-3",
              category.bannerUrl && "border-t border-border/60",
            )}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {category.icon
                  ? <img src={category.icon} alt="" className="h-full w-full object-cover" />
                  : <Layers className="size-4 text-muted-foreground/50" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold text-foreground">{category.name}</h1>
                {category.description && (
                  <p className="truncate text-xs text-muted-foreground">{category.description}</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-muted/30" />
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
                name={product.name}
                description={product.description}
                iconUrl={product.icon}
                categoryIconUrl={category?.icon ?? ""}
                categoryName={category?.name ?? ""}
                resources={product.resources}
                prices={product.prices}
                isFeatured={product.isFeatured}
                currency={product.currency}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
