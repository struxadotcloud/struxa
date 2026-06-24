"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { orpc } from "@/utils/orpc";

function CategoryCard({
  name,
  description,
  iconUrl,
  bannerUrl,
  planCount,
  href,
}: {
  name: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  planCount: number;
  href: string;
}) {
  const t = useTranslations("panel.billing");
  return (
    <Link href={href as never} className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative h-32 overflow-hidden">
        {bannerUrl
          ? <img src={bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="h-full w-full bg-gradient-to-br from-muted to-muted/40" />
        }
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
      </div>

      <div className="relative -mt-8 flex items-end gap-3 px-4 pb-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted shadow-sm">
          {iconUrl
            ? <img src={iconUrl} alt="" className="h-full w-full object-cover" />
            : <Layers className="size-5 text-muted-foreground/60" />
          }
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {planCount} {planCount === 1 ? t("plan") : t("plans")}
        </span>
        <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t("getStarted")} →
        </span>
      </div>
    </Link>
  );
}

export default function BillingPage() {
  const t = useTranslations("panel.billing");

  const { data: categories = [], isLoading: catsLoading } = useQuery(
    orpc.billing.listCategories.queryOptions(),
  );
  const { data: allProducts = [], isLoading: productsLoading } = useQuery(
    orpc.billing.listProducts.queryOptions(),
  );

  const isLoading = catsLoading || productsLoading;

  const planCountByCategory = new Map<string, number>();
  for (const p of allProducts) {
    planCountByCategory.set(p.categoryId, (planCountByCategory.get(p.categoryId) ?? 0) + 1);
  }

  const visibleCategories = categories.filter((c) => (planCountByCategory.get(c.id) ?? 0) > 0);

  return (
    <div className="flex-1 overflow-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        <div>
          <h1 className="text-sm font-semibold text-foreground">{t("shopTitle")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("shopSubtitle")}</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
        ) : visibleCategories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Layers className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                description={cat.description}
                iconUrl={cat.icon}
                bannerUrl={cat.bannerUrl}
                planCount={planCountByCategory.get(cat.id) ?? 0}
                href={`/billing/${cat.slug}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
