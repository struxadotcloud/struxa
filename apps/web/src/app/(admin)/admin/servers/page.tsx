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

const STATUS_COLOR: Record<string, string> = {
  "": "#22c55e",
  installing: "#888888",
  install_failed: "#f43f5e",
  restoring_backup: "#888888",
};

const STATUS_LABEL: Record<string, string> = {
  "": "Installed",
  installing: "Installing",
  install_failed: "Install Failed",
  restoring_backup: "Restoring",
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Monitor className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Servers</span>
          {servers && (
            <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
              {servers.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#555555]" />
            <input
              className="border border-[#333333] bg-[#0a0a0a] py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
              placeholder="Search servers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link
            href={"/admin/servers/new" as never}
            className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
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
        <label className="flex items-center gap-2 text-xs text-[#888888]">
          <input
            type="checkbox"
            checked={purge}
            onChange={(e) => setPurge(e.target.checked)}
            className="h-3 w-3"
          />
          Purge files from node
        </label>
      </ConfirmDialog>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              {search ? "No servers match your search." : "No servers yet."}
            </div>
          )}
          {filtered.map((server) => {
            const isSuspended = (server as { suspended?: boolean }).suspended;
            const statusColor = isSuspended ? "#555555" : (STATUS_COLOR[server.status] ?? "#888888");
            const statusLabel = isSuspended ? "Suspended" : (STATUS_LABEL[server.status] ?? server.status);
            const actions = serverActions({ uuid: server.uuid, name: server.name });

            return (
              <ContextMenu key={server.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                      <Link
                        href={`/admin/servers/${server.uuid}` as never}
                        className="text-sm font-medium text-white transition-colors hover:text-[#22c55e]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {server.name}
                      </Link>
                      <span className="font-mono text-xs text-[#555555]">
                        {server.allocation.ip}:{server.allocation.port}
                      </span>
                      <span className="text-xs text-[#444444]">
                        {(server as { node?: { name: string } }).node?.name ?? "—"}
                      </span>
                      <span className="text-xs" style={{ color: statusColor }}>{statusLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#444444]">
                        {server.memory} MB · {server.disk} MB disk
                      </span>
                      <Link
                        href={`/servers/${server.uuid}` as never}
                        className="text-[#555555] transition-colors hover:text-white"
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
