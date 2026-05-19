"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Loader2 } from "lucide-react";
import { orpc } from "@/utils/orpc";

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
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#555555]" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-white">{server.name}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#888888]">Installing</p>
          <p className="mt-2 max-w-xs text-xs text-[#555555]">
            Your server is being set up. This page will automatically update when installation
            completes.
          </p>
        </div>
      </div>
    );
  }

  if (server.suspended) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <Lock className="h-8 w-8 text-[#f43f5e]/50" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-white">{server.name}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#f43f5e]">Suspended</p>
          <p className="mt-2 max-w-xs text-xs text-[#555555]">
            This server has been suspended by an administrator. Contact support if you believe
            this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
