"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";

export default function NodeDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("admin.nodes");
  const pathname = usePathname();
  const { data: node } = useQuery(orpc.nodes.get.queryOptions({ input: { id } }));

  const TABS = [
    { key: "settings", label: t("tabSettings"), path: "" },
    { key: "monitoring", label: t("tabMonitoring"), path: "/monitoring" },
    { key: "allocations", label: t("tabAllocations"), path: "/allocations" },
    { key: "configuration", label: t("tabConfiguration"), path: "/configuration" },
  ];

  const activeTab = pathname.endsWith("/monitoring")
    ? "monitoring"
    : pathname.endsWith("/allocations")
      ? "allocations"
      : pathname.endsWith("/configuration")
        ? "configuration"
        : "settings";

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-2 text-sm">
          <Link
            href={"/admin/nodes" as never}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nodesLink")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-medium text-foreground">{node?.name ?? "…"}</span>
        </div>

        <div className="mb-4 flex items-center gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/nodes/${id}${tab.path}` as never}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}
