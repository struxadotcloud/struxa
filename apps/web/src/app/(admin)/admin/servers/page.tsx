"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Monitor, Plus, ExternalLink, Trash2, Search } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.servers.key() });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "":               { label: "Installed",     color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  installing:       { label: "Installing",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  install_failed:   { label: "Install Failed",color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  restoring_backup: { label: "Restoring",     color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
};

export default function AdminServersPage() {
  const { data: servers, isLoading } = useQuery(orpc.servers.list.queryOptions());
  const deleteMutation = useMutation(orpc.servers.delete.mutationOptions({ onSuccess: invalidate }));

  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [purge, setPurge] = useState(false);

  const filtered = (servers ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.allocation.ip.includes(q) ||
      ((s as { node?: { name: string } }).node?.name ?? "").toLowerCase().includes(q)
    );
  });

  function serverActions(server: { uuid: string; name: string }): ActionItem[] {
    return [
      {
        label: "View Panel",
        icon: ExternalLink,
        onClick: () => { window.location.href = `/servers/${server.uuid}`; },
      },
      "separator",
      {
        label: "Delete",
        icon: Trash2,
        onClick: () => { setConfirmDelete(server.uuid); setPurge(false); },
        destructive: true,
      },
    ];
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Servers</span>
          {servers && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {servers.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder="Search servers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link
            href={"/admin/servers/new" as never}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            New Server
          </Link>
        </div>
      </header>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) { setConfirmDelete(null); setPurge(false); } }}
        title="Delete server?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteMutation.mutateAsync({ id: confirmDelete, purgeData: purge });
          setConfirmDelete(null);
          setPurge(false);
        }}
      >
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={purge}
            onChange={(e) => setPurge(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          Purge files from node
        </label>
      </ConfirmDialog>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_180px_120px_120px_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <span className="text-xs font-medium text-muted-foreground">Address</span>
            <span className="text-xs font-medium text-muted-foreground">Node</span>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? "No servers match your search." : "No servers yet."}
            </div>
          )}
          {filtered.map((server, i) => {
            const isSuspended = (server as { suspended?: boolean }).suspended;
            const cfg = isSuspended
              ? { label: "Suspended", color: "#71717a", bg: "rgba(113,113,122,0.10)" }
              : (STATUS_CONFIG[server.status] ?? { label: server.status, color: "#71717a", bg: "rgba(113,113,122,0.10)" });
            const actions = serverActions({ uuid: server.uuid, name: server.name });
            const isLast = i === filtered.length - 1;

            return (
              <ContextMenu key={server.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className={`grid grid-cols-[24px_1fr_180px_120px_120px_48px] items-center px-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/servers/${server.uuid}` as never}
                        className="text-sm font-medium text-foreground transition-colors hover:text-green-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {server.name}
                      </Link>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {server.allocation.ip}:{server.allocation.port}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(server as { node?: { name: string } }).node?.name ?? "—"}
                    </span>
                    <span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/servers/${server.uuid}` as never}
                        className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                        title="View panel"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <RowMenu items={actions} />
                    </div>
                  </div>
                )}
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </>
  );
}
