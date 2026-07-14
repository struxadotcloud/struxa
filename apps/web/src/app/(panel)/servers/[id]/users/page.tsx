"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
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
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
      active ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"
    }`}>
      {perm}
    </span>
  );
}

export default function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.users");
  const tc = useTranslations("common");
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
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.subusers.list.queryOptions({ input: { serverId: serverId ?? "" } }));
      toast.success(tc("deleted"));
    },
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
    toast.success(t("inviteSuccess"));
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
            <DialogTitle>{t("inviteTitle")}</DialogTitle>
            <DialogDescription>{t("inviteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("emailLabel")}</label>
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
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">{t("permissionsLabel")}</label>
                <button
                  type="button"
                  onClick={() => setInvitePermissions(invitePermissions.length === ALL_PERMISSIONS.length ? [] : [...ALL_PERMISSIONS])}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {invitePermissions.length === ALL_PERMISSIONS.length ? t("deselectAll") : t("selectAll")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {ALL_PERMISSIONS.map((perm) => {
                  const active = invitePermissions.includes(perm);
                  return (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePerm(perm)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="capitalize">{perm}</span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-blue-500" : "bg-muted-foreground/30"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending}
            >
              {t("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={!inviteEmail.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? t("inviting") : t("inviteUser")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{t("sectionTitle")}</p>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t("inviteUser")}
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("colUser")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colActions")}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {subusersPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("loading")}</div>
            ) : subusers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {t("inviteFirst")}
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

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-[220px]">
          <div className="overflow-y-auto">
            <StatRow icon={Users} label={t("statSubusers")}>
              <span className="text-xl font-bold text-foreground">{subusers.length}</span>
            </StatRow>
            <StatRow icon={ShieldCheck} label={t("statNote")}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("statNoteText")}
              </p>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
