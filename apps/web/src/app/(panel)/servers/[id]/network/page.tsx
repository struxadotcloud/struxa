"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Globe, Copy, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

  const { data: server, isPending: serverPending } = useQuery(
    orpc.servers.get.queryOptions({ input: { id } }),
  );

  if (isPending || !session) return <Loader />;

  const alloc = server?.allocation;

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${id}`} className="text-[#555555] transition-colors hover:text-white">
            {server?.name ?? id}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Network</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[28px_180px_80px_1fr] border-b border-r border-[#222222] px-3 py-2">
              <span />
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">IP Address</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Port</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Alias / Notes</span>
            </div>
            {serverPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">Loading…</div>
            ) : !alloc ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">No allocation assigned</div>
            ) : (
              <div className="grid grid-cols-[28px_180px_80px_1fr] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors">
                <span className="flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 fill-white text-white" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{alloc.ip}</span>
                  <button type="button" onClick={() => copy(alloc.ip)} className="text-[#444444] hover:text-white transition-colors">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span className="font-mono text-sm text-white">{alloc.port}</span>
                <span className="text-sm text-[#555555]">Primary</span>
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Globe} label="PRIMARY">
            <span className="font-mono text-base font-bold text-white">
              {alloc ? `${alloc.ip}:${alloc.port}` : "—"}
            </span>
          </StatRow>
          <StatRow icon={Globe} label="ALLOCATIONS">
            <span className="text-2xl font-bold text-white">{alloc ? 1 : 0}</span>
          </StatRow>
          <StatRow icon={Globe} label="NOTE">
            <p className="text-xs text-[#555555] leading-relaxed">
              The primary allocation is used as the server&apos;s connection address.
            </p>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
