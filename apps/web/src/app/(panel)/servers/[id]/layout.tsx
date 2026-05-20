"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";

function BlockedPage({
  name,
  state,
}: {
  name: string;
  state: "installing" | "suspended";
}) {
  const suspended = state === "suspended";

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            suspended
              ? "bg-red-500/10 text-red-500"
              : "bg-amber-500/10 text-amber-500"
          }`}
        >
          {suspended ? "Suspended" : "Installing"}
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div
          className={`flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border p-8 text-center shadow-sm ${
            suspended
              ? "border-red-500/20 bg-red-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              suspended ? "bg-red-500/10" : "bg-amber-500/10"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full ${suspended ? "" : "animate-pulse"} ${
                suspended ? "bg-red-500/50" : "bg-amber-500"
              }`}
            />
          </span>

          <div className="flex flex-col gap-1.5">
            <p className="text-base font-semibold text-foreground">{name}</p>
            <p className={`text-sm font-medium ${suspended ? "text-red-500" : "text-amber-500"}`}>
              {suspended ? "Server Suspended" : "Installing…"}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {suspended
              ? "Access to this server has been restricted by an administrator. Contact support if you believe this is a mistake."
              : "Your server is being set up. This page will refresh automatically once it's ready."}
          </p>
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
    refetchInterval: 5000,
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
