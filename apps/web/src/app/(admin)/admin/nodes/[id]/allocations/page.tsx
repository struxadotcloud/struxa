"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateNode(id: string) {
  void queryClient.invalidateQueries(orpc.nodes.get.queryOptions({ input: { id } }));
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

export default function NodeAllocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin.nodes");
  const tc = useTranslations("common");
  const { data: node, isLoading } = useQuery(orpc.nodes.get.queryOptions({ input: { id } }));

  const addAllocMutation = useMutation(
    orpc.allocations.create.mutationOptions({
      onSuccess: () => { invalidateNode(id); toast.success(tc("created")); },
    }),
  );
  const deleteAllocMutation = useMutation(
    orpc.allocations.delete.mutationOptions({
      onSuccess: () => { invalidateNode(id); toast.success(tc("deleted")); },
    }),
  );

  const [allocForm, setAllocForm] = useState({ ip: "", ports: "", ipAlias: "" });
  const [addingAlloc, setAddingAlloc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleAddAlloc() {
    if (!allocForm.ip.trim() || !allocForm.ports.trim()) return;
    await addAllocMutation.mutateAsync({
      nodeId: id,
      ip: allocForm.ip,
      ports: allocForm.ports,
      ...(allocForm.ipAlias.trim() ? { ipAlias: allocForm.ipAlias.trim() } : {}),
    });
    setAllocForm({ ip: "", ports: "", ipAlias: "" });
    setAddingAlloc(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {t("notFound")}
      </div>
    );
  }

  const allocations = node.allocations ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">{t("allocationsTitle")}</span>
        <button
          type="button"
          onClick={() => setAddingAlloc(true)}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
        >
          <Plus className="h-3 w-3" />
          {t("addAllocation")}
        </button>
      </div>

      {addingAlloc && (
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("ipLabel")} <span className="text-destructive">*</span>
              </label>
              <input
                className={inputClass()}
                placeholder="0.0.0.0"
                value={allocForm.ip}
                onChange={(e) => setAllocForm((f) => ({ ...f, ip: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("portsLabel")} <span className="text-destructive">*</span>
              </label>
              <input
                className={inputClass()}
                placeholder={t("portsPlaceholder")}
                value={allocForm.ports}
                onChange={(e) => setAllocForm((f) => ({ ...f, ports: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("ipAliasLabel")}{" "}
                <span className="font-normal text-muted-foreground">{t("ipAliasOptional")}</span>
              </label>
              <input
                className={inputClass()}
                placeholder={t("ipAliasPlaceholder")}
                value={allocForm.ipAlias}
                onChange={(e) => setAllocForm((f) => ({ ...f, ipAlias: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAddAlloc}
              disabled={addAllocMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {addAllocMutation.isPending ? tc("adding") : tc("add")}
            </button>
            <button
              type="button"
              onClick={() => setAddingAlloc(false)}
              className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {allocations.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noAllocations")}
          </div>
        )}
        {allocations.map((alloc) => (
          <div
            key={alloc.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: alloc.serverId
                    ? "rgb(var(--muted-foreground) / 0.4)"
                    : "#3b82f6",
                }}
              />
              <span className="text-sm text-foreground">
                {alloc.ip}:{alloc.port}
              </span>
              {alloc.ipAlias && (
                <span className="text-xs text-muted-foreground">{alloc.ipAlias}</span>
              )}
              {alloc.serverId && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {t("assigned")}
                </span>
              )}
            </div>
            {!alloc.serverId &&
              (confirmDelete === alloc.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteAllocMutation.mutateAsync({ id: alloc.id });
                      setConfirmDelete(null);
                    }}
                    className="rounded-lg bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground"
                  >
                    {tc("delete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    {tc("cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(alloc.id)}
                  className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
