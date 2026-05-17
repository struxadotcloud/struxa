"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Users, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, Ban, UserX, Trash2 } from "lucide-react";
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Users className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Users</span>
          {data && (
            <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
              {data.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#555555]" />
            <input
              className="border border-[#333333] bg-[#0a0a0a] py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Ban dialog */}
        {dialog?.type === "ban" && (
          <div className="border-b border-[#222222] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">Ban {dialog.name}</p>
            <div className="flex items-center gap-3">
              <input
                autoFocus
                className="flex-1 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                placeholder="Ban reason (optional)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDialog(null);
                }}
              />
              <button
                type="button"
                disabled={banMutation.isPending}
                onClick={async () => {
                  await banMutation.mutateAsync({ userId: dialog.userId, reason: banReason || undefined });
                  setDialog(null);
                  setBanReason("");
                }}
                className="bg-[#f43f5e] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {banMutation.isPending ? "Banning..." : "Ban"}
              </button>
              <button
                type="button"
                onClick={() => { setDialog(null); setBanReason(""); }}
                className="bg-neutral-800 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {dialog?.type === "confirmDelete" && (
          <div className="flex items-center gap-3 border-b border-[#222222] px-4 py-3">
            <span className="text-sm text-[#f43f5e]">Delete {dialog.name}?</span>
            <span className="text-xs text-[#555555]">This cannot be undone.</span>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync({ userId: dialog.userId });
                setDialog(null);
              }}
              className="bg-[#f43f5e] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <button type="button" onClick={() => setDialog(null)} className="bg-neutral-800 px-3 py-1 text-xs font-medium text-white">
              Cancel
            </button>
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_100px_80px_120px_36px] border-b border-[#222222] px-4 py-2">
          <span className="text-[10px] uppercase tracking-wider text-[#555555]">User</span>
          <span className="text-[10px] uppercase tracking-wider text-[#555555]">Email</span>
          <span className="text-[10px] uppercase tracking-wider text-[#555555]">Role</span>
          <span className="text-[10px] uppercase tracking-wider text-[#555555]">Status</span>
          <span className="text-[10px] uppercase tracking-wider text-[#555555]">Joined</span>
          <span />
        </div>

        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">Loading...</div>
          )}
          {!isLoading && data?.users.length === 0 && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">No users found.</div>
          )}
          {data?.users.map((u) => {
            const actions = userActions(u);
            return (
              <ContextMenu key={u.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className="grid grid-cols-[1fr_1fr_100px_80px_120px_36px] items-center border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#222222] text-xs font-medium text-white">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white">{u.name ?? "—"}</span>
                    </div>

                    <span className="font-mono text-xs text-[#888888]">{u.email}</span>

                    <span
                      className={`w-fit px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                        u.role === "admin" ? "bg-white/10 text-white" : "bg-[#333333] text-[#888888]"
                      }`}
                    >
                      {u.role ?? "user"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {u.banned ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#f43f5e]" />
                          <span className="text-xs text-[#f43f5e]">Banned</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                          <span className="text-xs text-[#888888]">Active</span>
                        </>
                      )}
                    </div>

                    <span className="text-xs text-[#555555]">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </span>

                    <RowMenu items={actions} />
                  </div>
                )}
              </ContextMenu>
            );
          })}
        </div>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#222222] px-4 py-3">
            <span className="text-xs text-[#555555]">
              Page {page} of {totalPages} · {data.total} users
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 bg-neutral-800 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 bg-neutral-800 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
