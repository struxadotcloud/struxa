"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
  TooltipProvider,
} from "@struxa/ui/components/tooltip";
import { BackupDestinationForm, defaultBackupDestination } from "@/components/backup-destination-form";
import type { BackupDestinationInput } from "@struxa/api/lib/backup-destinations";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateNode(id: string) {
  void queryClient.invalidateQueries(orpc.nodes.get.queryOptions({ input: { id } }));
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  requiresRestart,
  requiresRestartText,
  children,
}: {
  label: string;
  description?: string;
  requiresRestart?: boolean;
  requiresRestartText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40 transition-colors">
      <div className="flex flex-col gap-0.5 max-w-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {requiresRestart && (
            <Tooltip>
              <TooltipTrigger className="flex items-center text-amber-500/70 hover:text-amber-500 transition-colors">
                <TriangleAlert className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipPopup side="top" sideOffset={4}>
                {requiresRestartText}
              </TooltipPopup>
            </Tooltip>
          )}
        </div>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-green-500" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}


function inputClass(width = "w-64") {
  return `${width} rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors`;
}

type FormState = {
  name: string;
  description: string;
  fqdn: string;
  scheme: "https" | "http";
  memory: number;
  memoryOverallocate: number;
  disk: number;
  diskOverallocate: number;
  uploadSize: number;
  daemonListen: number;
  daemonSFTP: number;
  daemonBase: string;
  maintenanceMode: boolean;
};

export default function NodeSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin.nodes");
  const tc = useTranslations("common");
  const { data: node, isLoading } = useQuery(orpc.nodes.get.queryOptions({ input: { id } }));

  const updateMutation = useMutation(
    orpc.nodes.update.mutationOptions({
      onSuccess: () => { invalidateNode(id); toast.success(tc("saved")); },
    }),
  );

  const { data: nodeDestination } = useQuery(orpc.backupDestinations.getForNode.queryOptions({ input: { nodeId: id } }));
  const upsertDestinationMutation = useMutation(orpc.backupDestinations.upsertForNode.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.backupDestinations.key() });
    },
  }));
  const clearDestinationMutation = useMutation(orpc.backupDestinations.clearForNode.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.backupDestinations.key() });
    },
  }));

  const [backupUseGlobal, setBackupUseGlobal] = useState(true);
  const [backupDestination, setBackupDestination] = useState<BackupDestinationInput | null>(null);

  const initialized = useRef(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    fqdn: "",
    scheme: "https",
    memory: 0,
    memoryOverallocate: 0,
    disk: 0,
    diskOverallocate: 0,
    uploadSize: 100,
    daemonListen: 8080,
    daemonSFTP: 2022,
    daemonBase: "/var/lib/pterodactyl",
    maintenanceMode: false,
  });

  useEffect(() => {
    if (node && !initialized.current) {
      initialized.current = true;
      setForm({
        name: node.name,
        description: node.description ?? "",
        fqdn: node.fqdn,
        scheme: node.scheme as "https" | "http",
        memory: node.memory,
        memoryOverallocate: node.memoryOverallocate,
        disk: node.disk,
        diskOverallocate: node.diskOverallocate,
        uploadSize: node.uploadSize,
        daemonListen: node.daemonListen,
        daemonSFTP: node.daemonSFTP,
        daemonBase: node.daemonBase,
        maintenanceMode: node.maintenanceMode,
      });
    }
  }, [node]);

  useEffect(() => {
    if (!nodeDestination || backupDestination !== null) return;
    setBackupDestination(nodeDestination);
    setBackupUseGlobal(false);
  }, [nodeDestination, backupDestination]);

  async function handleSave() {
    await Promise.all([
      updateMutation.mutateAsync({
        id,
        name: form.name,
        description: form.description.trim() || undefined,
        fqdn: form.fqdn,
        scheme: form.scheme,
        memory: form.memory,
        memoryOverallocate: form.memoryOverallocate,
        disk: form.disk,
        diskOverallocate: form.diskOverallocate,
        uploadSize: form.uploadSize,
        daemonListen: form.daemonListen,
        daemonSFTP: form.daemonSFTP,
        daemonBase: form.daemonBase,
        maintenanceMode: form.maintenanceMode,
      }),
      backupUseGlobal
        ? clearDestinationMutation.mutateAsync({ nodeId: id })
        : backupDestination
          ? upsertDestinationMutation.mutateAsync({ nodeId: id, ...backupDestination })
          : Promise.resolve(),
    ]);
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

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-3">
      <SectionCard title={t("generalSection")}>
        <SettingRow label={t("nameLabel")}>
          <input
            className={inputClass()}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Node"
          />
        </SettingRow>
        <SettingRow label={t("descriptionLabel")} description={t("descriptionDesc")}>
          <textarea
            className={`${inputClass()} resize-none`}
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("descriptionPlaceholder")}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title={t("networkSection")} description={t("networkDesc")}>
        <SettingRow label={t("fqdnLabel")} description={t("fqdnDesc")}>
          <input
            className={inputClass()}
            value={form.fqdn}
            onChange={(e) => setForm((f) => ({ ...f, fqdn: e.target.value }))}
            placeholder={t("fqdnSettingsPlaceholder")}
          />
        </SettingRow>
        <SettingRow label={t("secureLabel")} description={t("secureDesc")}>
          <Toggle
            checked={form.scheme === "https"}
            onChange={(v) => setForm((f) => ({ ...f, scheme: v ? "https" : "http" }))}
          />
        </SettingRow>
        <SettingRow label={t("daemonPortLabel")} description={t("daemonPortDesc")} requiresRestart requiresRestartText={t("requiresRestart")}>
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.daemonListen}
            onChange={(e) => setForm((f) => ({ ...f, daemonListen: Number(e.target.value) }))}
          />
        </SettingRow>
        <SettingRow label={t("sftpPortLabel")} description={t("sftpPortDesc")} requiresRestart requiresRestartText={t("requiresRestart")}>
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.daemonSFTP}
            onChange={(e) => setForm((f) => ({ ...f, daemonSFTP: Number(e.target.value) }))}
          />
        </SettingRow>
        <SettingRow label={t("daemonBaseLabel")} description={t("daemonBaseDesc")} requiresRestart requiresRestartText={t("requiresRestart")}>
          <input
            className={inputClass()}
            value={form.daemonBase}
            onChange={(e) => setForm((f) => ({ ...f, daemonBase: e.target.value }))}
            placeholder={t("daemonBasePlaceholder")}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title={t("resourcesSection")} description={t("resourcesDesc")}>
        <SettingRow label={t("memoryLabel")}>
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.memory}
            onChange={(e) => setForm((f) => ({ ...f, memory: Number(e.target.value) }))}
          />
        </SettingRow>
        <SettingRow
          label={t("memoryOverallocateLabel")}
          description={t("overallocateDesc")}
        >
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.memoryOverallocate}
            onChange={(e) =>
              setForm((f) => ({ ...f, memoryOverallocate: Number(e.target.value) }))
            }
          />
        </SettingRow>
        <SettingRow label={t("diskLabel")}>
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.disk}
            onChange={(e) => setForm((f) => ({ ...f, disk: Number(e.target.value) }))}
          />
        </SettingRow>
        <SettingRow
          label={t("diskOverallocateLabel")}
          description={t("overallocateDesc")}
        >
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.diskOverallocate}
            onChange={(e) => setForm((f) => ({ ...f, diskOverallocate: Number(e.target.value) }))}
          />
        </SettingRow>
        <SettingRow label={t("uploadSizeLabel")} description={t("uploadSizeDesc")}>
          <input
            type="number"
            className={inputClass("w-32")}
            value={form.uploadSize}
            onChange={(e) => setForm((f) => ({ ...f, uploadSize: Number(e.target.value) }))}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title={t("statusSection")}>
        <SettingRow
          label={t("maintenanceLabel")}
          description={t("maintenanceDesc")}
        >
          <Toggle
            checked={form.maintenanceMode}
            onChange={(v) => setForm((f) => ({ ...f, maintenanceMode: v }))}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title={t("backupDestinationSection")} description={t("backupDestinationSectionDesc")}>
        <div className="px-4 py-3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("backupUseGlobal")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("backupUseGlobalDesc")}</p>
            </div>
            <Toggle checked={backupUseGlobal} onChange={setBackupUseGlobal} />
          </div>
          {!backupUseGlobal && (
            <BackupDestinationForm
              value={backupDestination ?? defaultBackupDestination("s3")}
              onChange={setBackupDestination}
            />
          )}
        </div>
      </SectionCard>

      <div className="flex items-center justify-between">
        <div>
          {updateMutation.isSuccess && (
            <span className="text-xs text-green-500">{tc("saved")}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {updateMutation.isPending ? tc("saving") : t("saveChanges")}
        </button>
      </div>
    </div>
    </TooltipProvider>
  );
}
