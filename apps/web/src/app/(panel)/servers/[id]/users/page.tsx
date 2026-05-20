"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Users, ShieldCheck, UserPlus, Trash2, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function StatRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
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

const ALL_PERMISSIONS = [
  "console", "files", "backups", "databases",
  "schedules", "users", "network", "startup", "settings",
] as const;

type Permission = typeof ALL_PERMISSIONS[number];

function PermissionPill({ perm, active }: { perm: Permission; active: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
      active ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
    }`}>
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
  const [invitePermissions, setInvitePermissions] = useState<Permission[]>([]);

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
    onSuccess: () => void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId: serverId ?? "" } })),
  });

  function closeInvite() {
    setShowInvite(false);
    setInviteEmail("");
    setInvitePermissions([]);
  }

  async function handleInvite() {
    if (!serverId || !inviteEmail.trim()) return;
    await createMutation.mutateAsync({ serverId, email: inviteEmail.trim(), permissions: invitePermissions });
    void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId } }));
    closeInvite();
  }

  function togglePerm(perm: Permission) {
    setInvitePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  if (isPending || !session) return <Loader />;

  return (
    <>
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) closeInvite(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Enter the email address of the user you want to add to this server.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Email Address</label>
              <input
                autoFocus
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); if (e.key === "Escape") closeInvite(); }}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-foreground">Permissions</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PERMISSIONS.map((perm) => {
                  const active = invitePermissions.includes(perm);
                  return (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePerm(perm)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-green-500/10 text-green-600 ring-1 ring-green-500/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {perm}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Click to toggle. Leave blank for view-only access.</p>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">{createMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={!inviteEmail.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? "Inviting…" : "Invite User"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">Game Servers</Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Link href={`/servers/${id}`} className="text-muted-foreground transition-colors hover:text-foreground">{server?.name ?? id}</Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Users</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite User
        </button>
      </header>

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1fr_auto] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">User</span>
            <span className="text-xs font-medium text-muted-foreground">Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {subusersPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : subusers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No subusers yet</p>
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Invite first user
                </button>
              </div>
            ) : (
              subusers.map((sub, i) => {
                const user = sub.user as { name: string | null; email: string } | undefined;
                const permissions: string[] = (() => {
                  try { return JSON.parse(sub.permissions) as string[]; } catch { return []; }
                })();
                const isLast = i === subusers.length - 1;
                return (
                  <div key={sub.id} className={!isLast ? "border-b border-border" : ""}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground uppercase">
                          {(user?.name ?? user?.email ?? "?")[0]}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{user?.name ?? user?.email ?? "Unknown"}</span>
                          <div className="text-xs text-muted-foreground">{user?.email ?? sub.userId}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => serverId && deleteMutation.mutate({ serverId, userId: sub.userId })}
                        disabled={deleteMutation.isPending}
                        className="rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-destructive disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-muted/20 px-4 py-2.5">
                      {ALL_PERMISSIONS.map((perm) => (
                        <PermissionPill key={perm} perm={perm} active={permissions.includes(perm)} />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-y-auto">
            <StatRow icon={Users} label="Subusers">
              <span className="text-xl font-bold text-foreground">{subusers.length}</span>
            </StatRow>
            <StatRow icon={ShieldCheck} label="Note">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Subusers have panel access only. Permissions are scoped to this server and do not grant
                access to billing or account settings.
              </p>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
