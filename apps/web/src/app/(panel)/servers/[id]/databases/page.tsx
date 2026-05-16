"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Database, Copy, RefreshCw, Trash2, Plus, Eye, EyeOff, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockDatabases, type MockDatabase } from "@/lib/mock-data";
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

function DatabaseRow({ db }: { db: MockDatabase }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <div className="border-b border-[#222222]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[#111111] transition-colors text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-[#444444] transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Database className="h-4 w-4 shrink-0 text-[#555555]" />
        <span className="font-mono text-sm font-medium text-white flex-1">{db.name}</span>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-[#888888] border border-[#333333] hover:text-white hover:border-[#555555] transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Rotate Password
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 text-xs text-[#f43f5e] border border-[#f43f5e]/30 hover:border-[#f43f5e] transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-2 border-t border-[#1a1a1a]">
          <div className="border-r border-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Username</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{db.username}</span>
              <button type="button" className="text-[#444444] hover:text-white transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Password</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">
                {visible ? db.password : "••••••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="text-[#444444] hover:text-white transition-colors"
              >
                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className="text-[#444444] hover:text-white transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="border-r border-t border-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Host</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{db.host}</span>
              <button type="button" className="text-[#444444] hover:text-white transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="border-t border-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Port</p>
            <span className="font-mono text-sm text-white">{db.port}</span>
          </div>
          <div className="col-span-2 border-t border-[#1a1a1a] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Connection String</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#888888]">
                mysql://{db.username}:***@{db.host}:{db.port}/{db.name}
              </span>
              <button type="button" className="text-[#444444] hover:text-white transition-colors shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DatabasesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];

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
          <span className="text-white">Databases</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Database
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {mockDatabases.map((db) => (
            <DatabaseRow key={db.id} db={db} />
          ))}
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Database} label="DATABASES">
            <span className="text-2xl font-bold text-white">{mockDatabases.length}</span>
          </StatRow>
          <StatRow icon={Database} label="HOST">
            <span className="font-mono text-sm font-bold text-white leading-snug">
              {mockDatabases[0]?.host ?? "—"}
            </span>
          </StatRow>
          <StatRow icon={Database} label="NOTE">
            <p className="text-xs text-[#555555] leading-relaxed">
              Databases are provisioned on a shared MySQL host. Credentials are unique per database and
              cannot be shared across servers.
            </p>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
