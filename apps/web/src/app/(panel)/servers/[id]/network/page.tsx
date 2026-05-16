"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Globe, Copy, Trash2, Plus, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockAllocations } from "@/lib/mock-data";
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
    <div className="flex flex-col border-b border-[#222222]">
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#555555]">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];
  const primary = mockAllocations.find((a) => a.primary);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${server.id}`} className="text-[#555555] transition-colors hover:text-white">
            {server.name}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Network</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Allocation
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[28px_180px_80px_1fr_100px] border-b border-r border-[#222222] px-3 py-2">
              <span />
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">IP Address</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Port</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Alias / Notes</span>
              <span />
            </div>
            {mockAllocations.map((alloc) => (
              <div
                key={alloc.id}
                className="grid grid-cols-[28px_180px_80px_1fr_100px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
              >
                <span className="flex items-center justify-center">
                  {alloc.primary && (
                    <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{alloc.ip}</span>
                  <button type="button" className="text-[#444444] hover:text-white transition-colors">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span className="font-mono text-sm text-white">{alloc.port}</span>
                <div>
                  {alloc.alias ? (
                    <span className="text-sm text-[#888888]">{alloc.alias}</span>
                  ) : (
                    <button type="button" className="text-xs text-[#333333] hover:text-[#555555] transition-colors">
                      + add note
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 justify-end pr-1">
                  {!alloc.primary && (
                    <>
                      <button
                        type="button"
                        className="text-xs text-[#555555] hover:text-white transition-colors"
                      >
                        Set primary
                      </button>
                      <button
                        type="button"
                        className="text-[#444444] hover:text-[#f43f5e] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Globe} label="PRIMARY">
            <span className="font-mono text-base font-bold text-white">
              {primary ? `${primary.ip}:${primary.port}` : "—"}
            </span>
          </StatRow>
          <StatRow icon={Globe} label="ALLOCATIONS">
            <span className="text-2xl font-bold text-white">{mockAllocations.length}</span>
          </StatRow>
          <StatRow icon={Globe} label="NOTE">
            <p className="text-xs text-[#555555] leading-relaxed">
              The primary allocation is used as the server&apos;s connection address. Additional
              allocations can be used for RCON, query, or other services.
            </p>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
