"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";

function BlockedPage({
  name,
  state,
}: {
  name: string;
  state: "installing" | "suspended";
}) {
  const t = useTranslations("panel.server");
  const suspended = state === "suspended";

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          suspended ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
        }`}>
          {suspended ? t("suspended") : t("installing")}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          {suspended ? (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <ShieldOff className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-foreground">{t("suspendedTitle")}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("suspendedDescription")}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">{t("installingTitle")}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("installingDescription")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: server, isLoading } = useQuery({
    ...orpc.servers.get.queryOptions({ input: { id } }),
    refetchInterval: (query) => query.state.data?.status === "installing" ? 1500 : 5000,
    select: (s) => ({ status: s.status, suspended: s.suspended, name: s.name }),
  });

  if (isLoading || !server) return <>{children}</>;

  if (server.status === "installing") {
    return <BlockedPage name={server.name} state="installing" />;
  }

  if (server.suspended) {
    return <BlockedPage name={server.name} state="suspended" />;
  }

  return <>{children}</>;
}
