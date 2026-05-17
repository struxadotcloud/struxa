"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.servers.key() });
}

const STATUS_COLOR: Record<string, string> = {
  "": "#22c55e",
  installing: "#f59e0b",
  install_failed: "#f43f5e",
  restoring_backup: "#f59e0b",
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

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [purge, setPurge] = useState(false);

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
        <Link
          href={"/admin/servers/new" as never}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Server
        </Link>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              Loading...
            </div>
          )}
          {servers?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No servers yet.
            </div>
          )}
          {servers?.map((server) => {
            const isSuspended = (server as { suspended?: boolean }).suspended;
            const statusColor = isSuspended ? "#555555" : (STATUS_COLOR[server.status] ?? "#888888");
            const statusLabel = isSuspended ? "Suspended" : (STATUS_LABEL[server.status] ?? server.status);

            return (
              <div
                key={server.id}
                className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
              >
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                  <Link
                    href={`/servers/${server.uuid}` as never}
                    className="text-sm font-medium text-white transition-colors hover:text-[#22c55e]"
                  >
                    {server.name}
                  </Link>
                  <span className="font-mono text-xs text-[#555555]">
                    {server.allocation.ip}:{server.allocation.port}
                  </span>
                  <span className="text-xs text-[#444444]">{server.node.name}</span>
                  <span className="text-xs" style={{ color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#444444]">
                    {server.memory} MB · {server.disk} MB disk
                  </span>
                  <Link
                    href={`/admin/servers/${server.uuid}` as never}
                    className="text-[#555555] transition-colors hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {confirmDelete === server.uuid ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-[#f43f5e]">
                        <input
                          type="checkbox"
                          checked={purge}
                          onChange={(e) => setPurge(e.target.checked)}
                          className="h-3 w-3"
                        />
                        Purge data
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteMutation.mutateAsync({ id: server.uuid, purgeData: purge });
                          setConfirmDelete(null);
                          setPurge(false);
                        }}
                        className="bg-[#f43f5e] px-3 py-1 text-xs font-medium text-white"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmDelete(null); setPurge(false); }}
                        className="bg-neutral-700 px-3 py-1 text-xs font-medium text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(server.uuid)}
                      className="text-[#555555] transition-colors hover:text-[#f43f5e]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
