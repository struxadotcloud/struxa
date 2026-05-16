"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Users, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
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

const ALL_PERMISSIONS = [
  "console", "files", "backups", "databases",
  "schedules", "users", "network", "startup", "settings",
] as const;

type Permission = typeof ALL_PERMISSIONS[number];

function PermissionPill({ perm, active }: { perm: Permission; active: boolean }) {
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
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: subusers = [], isPending: subusersPending } = useQuery({
    ...orpc.subusers.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const createMutation = useMutation(orpc.subusers.create.mutationOptions());

  const deleteMutation = useMutation({
    ...orpc.subusers.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId: serverId ?? "" } }));
    },
  });

  if (isPending || !session) return <Loader />;

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
          <span className="text-white">Users</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222] transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite User
        </button>
      </header>

      {showInvite && (
        <div className="border-b border-[#222222] bg-[#0d0d0d] px-4 py-3 flex items-center gap-3">
          <input
            autoFocus
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555555] font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && serverId && inviteEmail.trim()) {
                createMutation.mutate({ serverId, email: inviteEmail.trim(), permissions: [] }, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId } }));
                    setShowInvite(false);
                    setInviteEmail("");
                  },
                });
              }
              if (e.key === "Escape") setShowInvite(false);
            }}
          />
          <button
            type="button"
            disabled={!serverId || !inviteEmail.trim() || createMutation.isPending}
            onClick={() => {
              if (serverId && inviteEmail.trim()) {
                createMutation.mutate({ serverId, email: inviteEmail.trim(), permissions: [] }, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId } }));
                    setShowInvite(false);
                    setInviteEmail("");
                  },
                });
              }
            }}
            className="px-4 py-1.5 text-sm font-medium bg-white text-black disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {createMutation.isPending ? "Inviting…" : "Invite"}
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(false)}
            className="px-3 py-1.5 text-sm text-[#555555] hover:text-white transition-colors"
          >
            Cancel
          </button>
          {createMutation.isError && (
            <span className="text-xs text-[#f43f5e]">{createMutation.error.message}</span>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {subusersPending ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#555555]">Loading…</div>
          ) : subusers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#555555]">No subusers yet</div>
          ) : (
            subusers.map((sub) => {
              const user = sub.user as { name: string | null; email: string } | undefined;
              const permissions: string[] = (() => {
                try { return JSON.parse(sub.permissions) as string[]; } catch { return []; }
              })();
              return (
                <div key={sub.id} className="border-b border-[#222222]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#1a1a1a] border border-[#333333] text-xs font-bold text-white uppercase">
                        {(user?.name ?? user?.email ?? "?")[0]}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white">{user?.name ?? user?.email ?? "Unknown"}</span>
                        <div className="text-xs text-[#555555]">{user?.email ?? sub.userId}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => serverId && deleteMutation.mutate({ serverId, userId: sub.userId })}
                      disabled={deleteMutation.isPending}
                      className="text-[#444444] hover:text-[#f43f5e] disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t border-[#1a1a1a] px-4 py-3">
                    {ALL_PERMISSIONS.map((perm) => (
                      <PermissionPill
                        key={perm}
                        perm={perm}
                        active={permissions.includes(perm)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Users} label="SUBUSERS">
            <span className="text-2xl font-bold text-white">{subusers.length}</span>
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
