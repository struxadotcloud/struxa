/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, Ban, UserX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const router = useRouter();
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

  const setRoleMutation = useMutation(orpc.users.setRole.mutationOptions({
    onSuccess: () => { invalidateUsers(); toast.success(tc("updated")); },
  }));
  const banMutation = useMutation(orpc.users.ban.mutationOptions({
    onSuccess: () => { invalidateUsers(); toast.success(tc("updated")); },
  }));
  const unbanMutation = useMutation(orpc.users.unban.mutationOptions({
    onSuccess: () => { invalidateUsers(); toast.success(tc("updated")); },
  }));
  const deleteMutation = useMutation(orpc.users.delete.mutationOptions({
    onSuccess: () => { invalidateUsers(); toast.success(tc("deleted")); },
  }));

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  function userActions(u: { id: string; name: string | null; email: string; role: string | null; banned: boolean | null }): ActionItem[] {
    const displayName = u.name ?? u.email;
    return [
      u.role !== "admin"
        ? { label: t("promoteToAdmin"), icon: ShieldCheck, onClick: () => setRoleMutation.mutate({ userId: u.id, role: "admin" }) }
        : { label: t("demoteToUser"), icon: ShieldOff, onClick: () => setRoleMutation.mutate({ userId: u.id, role: "user" }) },
      u.banned
        ? { label: t("unban"), icon: UserX, onClick: () => unbanMutation.mutate({ userId: u.id }) }
        : { label: t("ban"), icon: Ban, onClick: () => { setDialog({ type: "ban", userId: u.id, name: displayName }); setBanReason(""); } },
      "separator",
      { label: tc("delete"), icon: Trash2, onClick: () => setDialog({ type: "confirmDelete", userId: u.id, name: displayName }), destructive: true },
    ];
  }

  return (
    <>
      <Dialog open={dialog?.type === "ban"} onOpenChange={(open) => { if (!open) { setDialog(null); setBanReason(""); } }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("banTitle", { name: dialog?.type === "ban" ? dialog.name : "" })}</DialogTitle>
            <DialogDescription>{t("banDesc")}</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t("banReasonLabel")} <span className="text-muted-foreground font-normal">{t("banReasonOptional")}</span></label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder={t("banReasonPlaceholder")}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setDialog(null); setBanReason(""); } }}
            />
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={banMutation.isPending}
            >
              {tc("cancel")}
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
              {banMutation.isPending ? t("banning") : t("banUser")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={dialog?.type === "confirmDelete"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle", { name: dialog?.type === "confirmDelete" ? dialog.name : "" })}</DialogTitle>
            <DialogDescription>{t("deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={deleteMutation.isPending}
            >
              {tc("cancel")}
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
              {deleteMutation.isPending ? t("deleting") : t("deleteUser")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring transition-colors"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
        <div className="min-w-[560px] overflow-hidden rounded-xl border border-border bg-card">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_100px_80px_120px_36px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("userColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("emailColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("roleColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("statusColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("joinedColumn")}</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">{t("loading")}</div>
          )}
          {!isLoading && data?.users.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noUsers")}</div>
          )}
          {data?.users.map((u, i) => {
            const actions = userActions(u);
            const isLast = i === (data?.users.length ?? 0) - 1;
            return (
              <ContextMenu key={u.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    onClick={() => router.push(`/admin/users/${u.id}` as never)}
                    className={`grid grid-cols-[1fr_1fr_100px_80px_120px_36px] cursor-pointer items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
                        {u.image ? (
                          <img src={u.image} alt="" className="h-full w-full object-cover" />
                        ) : (u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{u.name ?? "—"}</span>
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
                          {t("banned")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                          {t("active")}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
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
        </div>

        {data && totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("pageInfo", { page, total: totalPages, count: data.total })}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
                {tc("prev")}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                {tc("next")}
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
