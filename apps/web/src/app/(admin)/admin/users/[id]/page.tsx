"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, Server, Shield, ShieldOff, Ban, UserCheck, Monitor } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc, queryClient } from "@/utils/orpc";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Tab = "overview" | "servers" | "security" | "actions";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "servers", label: "Servers" },
  { id: "security", label: "Security" },
  { id: "actions", label: "Admin Actions" },
];

function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 40);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{children}</span>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: user, isLoading, refetch } = useQuery(
    orpc.users.adminGet.queryOptions({ input: { userId } }),
  );

  const { data: sessions } = useQuery(
    orpc.users.adminGetSessions.queryOptions({ input: { userId } }),
  );

  const { data: serversData } = useQuery(
    orpc.users.adminGetServers.queryOptions({ input: { userId, page: 1 } }),
  );

  function invalidateUser() {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
  }

  const setRoleMutation = useMutation(orpc.users.setRole.mutationOptions({ onSuccess: invalidateUser }));
  const banMutation = useMutation(orpc.users.ban.mutationOptions({ onSuccess: invalidateUser }));
  const unbanMutation = useMutation(orpc.users.unban.mutationOptions({ onSuccess: invalidateUser }));
  const deleteMutation = useMutation(
    orpc.users.delete.mutationOptions({
      onSuccess: () => router.push("/admin/users" as never),
    }),
  );

  const [banDialog, setBanDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        User not found.
      </div>
    );
  }

  const displayName = user.name ?? user.email;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Dialogs */}
      <Dialog open={banDialog} onOpenChange={(open) => { setBanDialog(open); if (!open) setBanReason(""); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Ban {displayName}</DialogTitle>
            <DialogDescription>This user will be locked out of their account.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder="e.g. ToS violation"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            {banMutation.isError && (
              <p className="mt-2 text-xs text-destructive">{banMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={banMutation.isPending}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              disabled={banMutation.isPending}
              onClick={async () => {
                await banMutation.mutateAsync({ userId, reason: banReason || undefined });
                setBanDialog(false);
                setBanReason("");
              }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {banMutation.isPending ? "Banning…" : "Ban User"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={`Delete ${displayName}?`}
        description="This action is permanent and cannot be undone. All servers owned by this user will remain but become ownerless."
        confirmLabel="Delete User"
        destructive
        onConfirm={() => deleteMutation.mutate({ userId })}
        loading={deleteMutation.isPending}
      />

      {/* Header breadcrumb */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-4 py-2.5">
        <Link href="/admin/users" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Users
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-xs font-medium text-foreground">{displayName}</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "servers" && (serversData?.total ?? 0) > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {serversData!.total}
              </span>
            )}
            {t.id === "actions" && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">!</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <>
              <SectionCard title="Identity">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-foreground">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">{user.name ?? "—"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  <InfoRow label="Role">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.role === "admin" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                      {user.role ?? "user"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Status">
                    {user.banned ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">Banned</span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">Active</span>
                    )}
                  </InfoRow>
                  <InfoRow label="2FA">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Joined">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                  </InfoRow>
                  <InfoRow label="Servers">
                    <button
                      type="button"
                      onClick={() => setTab("servers")}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {user.serverCount} server{user.serverCount !== 1 ? "s" : ""}
                    </button>
                  </InfoRow>
                </div>
              </SectionCard>

              {user.banned && user.banReason && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <p className="text-xs font-semibold text-destructive">Ban Reason</p>
                  <p className="mt-1 text-sm text-foreground">{user.banReason}</p>
                  {user.banExpires && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expires {new Date(user.banExpires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              )}

              <SectionCard title="Billing Address">
                {user.billingAddressLine1 ? (
                  <div className="flex flex-col divide-y divide-border">
                    {user.billingName && <InfoRow label="Name">{user.billingName}</InfoRow>}
                    <InfoRow label="Address">{user.billingAddressLine1}{user.billingAddressLine2 ? `, ${user.billingAddressLine2}` : ""}</InfoRow>
                    <InfoRow label="City / State">{[user.billingCity, user.billingState].filter(Boolean).join(", ")}</InfoRow>
                    <InfoRow label="Postal Code">{user.billingPostalCode ?? "—"}</InfoRow>
                    <InfoRow label="Country">{user.billingCountry ?? "—"}</InfoRow>
                    {user.vatNumber && <InfoRow label="VAT">{user.vatNumber} ({user.vatCountry})</InfoRow>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No billing address on file.</p>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Servers ── */}
          {tab === "servers" && (
            <SectionCard title="Servers">
              {!serversData || serversData.servers.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No servers owned by this user.</div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1fr_120px_100px_90px] border-b border-border bg-muted/40 px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Name</span>
                    <span className="text-xs font-medium text-muted-foreground">Node</span>
                    <span className="text-xs font-medium text-muted-foreground">Allocation</span>
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                  </div>
                  {serversData.servers.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/admin/servers/${s.uuid}` as never}
                      className={`grid grid-cols-[1fr_120px_100px_90px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${i < serversData.servers.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.nodeName ?? "—"}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.allocationIp}:{s.allocationPort}
                      </span>
                      {s.suspended ? (
                        <span className="w-fit rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">Suspended</span>
                      ) : (
                        <span className="w-fit rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">Active</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <>
              <SectionCard title="Two-Factor Authentication">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">TOTP authenticator</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.twoFactorEnabled ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {user.twoFactorEnabled ? "Enabled" : "Not enabled"}
                  </span>
                </div>
              </SectionCard>

              <SectionCard title="Active Sessions">
                {!sessions || sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active sessions.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{parseUserAgent(s.userAgent)}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.ipAddress ?? "Unknown IP"} · Signed in {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${new Date(s.expiresAt) > new Date() ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {new Date(s.expiresAt) > new Date() ? "active" : "expired"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Admin Actions ── */}
          {tab === "actions" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-destructive/60">Admin Actions</p>
              <div className="flex flex-col gap-3">

                {/* Role */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.role === "admin"
                        ? "Remove admin privileges from this user."
                        : "Grant this user full admin access to the panel."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={setRoleMutation.isPending}
                    onClick={() => setRoleMutation.mutate({ userId, role: user.role === "admin" ? "user" : "admin" })}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40 ${
                      user.role === "admin"
                        ? "border border-border text-muted-foreground hover:bg-muted"
                        : "bg-foreground text-background hover:opacity-80"
                    }`}
                  >
                    {user.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {setRoleMutation.isPending ? "…" : user.role === "admin" ? "Demote" : "Promote"}
                  </button>
                </div>

                {/* Ban / Unban */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.banned ? "Unban User" : "Ban User"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {user.banned
                        ? "Allow this user to sign in again."
                        : "Prevent this user from signing in."}
                    </p>
                    {user.banned && user.banReason && (
                      <p className="mt-1 text-xs text-destructive/80">Reason: {user.banReason}</p>
                    )}
                  </div>
                  {user.banned ? (
                    <button
                      type="button"
                      disabled={unbanMutation.isPending}
                      onClick={() => unbanMutation.mutate({ userId })}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {unbanMutation.isPending ? "…" : "Unban"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBanDialog(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Ban
                    </button>
                  )}
                </div>

                {/* Delete */}
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete User</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Permanently remove this account. This cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteDialog(true)}
                    className="rounded-lg border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
