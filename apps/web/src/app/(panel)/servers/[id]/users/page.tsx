"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Users, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockSubusers, type SubuserPermission } from "@/lib/mock-data";
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

const ALL_PERMISSIONS: SubuserPermission[] = [
  "console", "files", "backups", "databases",
  "schedules", "users", "network", "startup", "settings",
];

function PermissionPill({ perm, active }: { perm: SubuserPermission; active: boolean }) {
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${
        active
          ? "border-[#22c55e]/40 text-[#22c55e]"
          : "border-[#222222] text-[#333333]"
      }`}
    >
      {perm}
    </span>
  );
}

export default function UsersPage({ params }: { params: Promise<{ id: string }> }) {
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
          <span className="text-white">Users</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222] transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite User
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {mockSubusers.map((user) => (
            <div key={user.id} className="border-b border-[#222222]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#1a1a1a] border border-[#333333] text-xs font-bold text-white uppercase">
                    {user.username[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{user.username}</span>
                      {user.twoFactor && (
                        <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-widest border border-[#22c55e]/40 text-[#22c55e]">
                          2FA
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#555555]">{user.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#555555]">
                  <span>Since {user.createdAt}</span>
                  <button
                    type="button"
                    className="text-[#444444] hover:text-[#f43f5e] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-[#1a1a1a] px-4 py-3">
                {ALL_PERMISSIONS.map((perm) => (
                  <PermissionPill
                    key={perm}
                    perm={perm}
                    active={user.permissions.includes(perm)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Users} label="SUBUSERS">
            <span className="text-2xl font-bold text-white">{mockSubusers.length}</span>
          </StatRow>
          <StatRow icon={ShieldCheck} label="NOTE">
            <p className="text-xs text-[#555555] leading-relaxed">
              Subusers have panel access only. Permissions are scoped to this server and do not grant
              access to billing or account settings.
            </p>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
