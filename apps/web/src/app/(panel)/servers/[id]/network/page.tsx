"use client";

import { useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Globe, Copy, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

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

export default function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.network");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server, isPending: serverPending } = useQuery(
    orpc.servers.get.queryOptions({ input: { id } }),
  );

  if (isPending || !session) return <Loader />;

  const alloc = server?.allocation as { ip: string; ipAlias: string | null; port: number } | null | undefined;
  const allocIp = alloc ? (alloc.ipAlias ?? alloc.ip) : null;

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[32px_1fr_100px_120px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">{t("colIp")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colPort")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colType")}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {serverPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("loading")}</div>
            ) : !alloc ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Globe className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("noAllocation")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-[32px_1fr_100px_120px] items-center px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{allocIp}</span>
                  <button
                    type="button"
                    onClick={() => copy(allocIp!)}
                    className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm text-foreground">{alloc.port}</span>
                <span>
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                    {t("typePrimary")}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm md:w-[220px]">
          <div className="overflow-y-auto">
            <StatRow icon={Globe} label={t("statPrimary")}>
              <span className="text-sm font-semibold text-foreground leading-snug">
                {alloc ? `${allocIp}:${alloc.port}` : "—"}
              </span>
            </StatRow>
            <StatRow icon={Globe} label={t("statAllocations")}>
              <span className="text-xl font-bold text-foreground">{alloc ? 1 : 0}</span>
            </StatRow>
            <StatRow icon={Globe} label={t("statNote")}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("statNoteText")}
              </p>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
