"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, Ban, UserX, Trash2 } from "lucide-react";
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
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";

function invalidateUsers() {
  void queryClient.invalidateQueries({ queryKey: orpc.users.key() });
}

type DialogState =
  | null
  | { type: "ban"; userId: string; name: string }
  | { type: "confirmDelete"; userId: string; name: string };

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [banReason, setBanReason] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  }

  const { data, isLoading } = useQuery(
    orpc.users.list.queryOptions({ input: { page, search: debouncedSearch || undefined } }),
  );

  const setRoleMutation = useMutation(orpc.users.setRole.mutationOptions({ onSuccess: invalidateUsers }));
  const banMutation = useMutation(orpc.users.ban.mutationOptions({ onSuccess: invalidateUsers }));
  const unbanMutation = useMutation(orpc.users.unban.mutationOptions({ onSuccess: invalidateUsers }));
  const deleteMutation = useMutation(orpc.users.delete.mutationOptions({ onSuccess: invalidateUsers }));

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  function userActions(u: { id: string; name: string | null; email: string; role: string | null; banned: boolean | null }): ActionItem[] {
    const displayName = u.name ?? u.email;
    return [
      u.role !== "admin"
        ? { label: "Promote to Admin", icon: ShieldCheck, onClick: () => setRoleMutation.mutate({ userId: u.id, role: "admin" }) }
        : { label: "Demote to User", icon: ShieldOff, onClick: () => setRoleMutation.mutate({ userId: u.id, role: "user" }) },
      u.banned
        ? { label: "Unban", icon: UserX, onClick: () => unbanMutation.mutate({ userId: u.id }) }
        : { label: "Ban", icon: Ban, onClick: () => { setDialog({ type: "ban", userId: u.id, name: displayName }); setBanReason(""); } },
      "separator",
      { label: "Delete", icon: Trash2, onClick: () => setDialog({ type: "confirmDelete", userId: u.id, name: displayName }), destructive: true },
    ];
  }

  return (
    <>
      <Dialog open={dialog?.type === "ban"} onOpenChange={(open) => { if (!open) { setDialog(null); setBanReason(""); } }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Ban {dialog?.type === "ban" ? dialog.name : ""}</DialogTitle>
            <DialogDescription>This user will be locked out of their account.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-1.5 block text-xs font-medium text-foreground">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder="e.g. ToS violation"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setDialog(null); setBanReason(""); } }}
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
                if (dialog?.type !== "ban") return;
                await banMutation.mutateAsync({ userId: dialog.userId, reason: banReason || undefined });
                setDialog(null);
                setBanReason("");
              }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {banMutation.isPending ? "Banning…" : "Ban User"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={dialog?.type === "confirmDelete"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {dialog?.type === "confirmDelete" ? dialog.name : ""}?</DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                if (dialog?.type !== "confirmDelete") return;
                await deleteMutation.mutateAsync({ userId: dialog.userId });
                setDialog(null);
              }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete User"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold text-foreground">Users</h1>
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring transition-colors"
              placeholder="Search users…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_100px_80px_120px_36px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">User</span>
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <span className="text-xs font-medium text-muted-foreground">Joined</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loadingâ€¦</div>
          )}
          {!isLoading && data?.users.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No users found.</div>
          )}
          {data?.users.map((u, i) => {
            const actions = userActions(u);
            const isLast = i === (data?.users.length ?? 0) - 1;
            return (
              <ContextMenu key={u.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className={`grid grid-cols-[1fr_1fr_100px_80px_120px_36px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{u.name ?? "â€”"}</span>
                    </div>

                    <span className="font-mono text-xs text-muted-foreground">{u.email}</span>

                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.role ?? "user"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {u.banned ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                          Banned
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          Active
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "â€”"}
                    </span>

                    <RowMenu items={actions} />
                  </div>
                )}
              </ContextMenu>
            );
          })}
        </div>

        {data && totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} Â· {data.total} users
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
