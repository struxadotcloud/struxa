"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, HardDriveDownload } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";

function BlockedPage({
  name,
  state,
}: {
  name: string;
  state: "installing" | "suspended";
}) {
  const installing = state === "installing";

  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0a]">
      {/* Matches the header bar height of other server pages */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#222222] px-4">
        <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
        <span className="text-sm text-white">{name}</span>
        <span
          className={`ml-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
            installing
              ? "border-[#555555]/40 text-[#555555]"
              : "border-[#f43f5e]/40 text-[#f43f5e]"
          }`}
        >
          {installing ? "Installing" : "Suspended"}
        </span>
      </header>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Icon */}
          <div
            className={`flex h-14 w-14 items-center justify-center border ${
              installing ? "border-[#222222]" : "border-[#f43f5e]/20"
            }`}
          >
            {installing ? (
              <HardDriveDownload
                className="h-6 w-6 text-[#555555]"
                strokeWidth={1.5}
              />
            ) : (
              <Lock className="h-6 w-6 text-[#f43f5e]/50" strokeWidth={1.5} />
            )}
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-white">{name}</p>
            {installing ? (
              <>
                <p className="text-xs text-[#555555]">
                  Installation in progress — this page will update automatically.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-[#555555]">
                  This server has been suspended by an administrator.
                </p>
                <p className="text-xs text-[#333333]">
                  Contact support if you believe this is a mistake.
                </p>
              </>
            )}
          </div>

          {/* Status dot */}
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                installing
                  ? "animate-pulse bg-[#555555]"
                  : "bg-[#f43f5e]/50"
              }`}
            />
            <span className="text-[10px] uppercase tracking-widest text-[#333333]">
              {installing ? "Installing" : "Suspended"}
            </span>
          </div>
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
