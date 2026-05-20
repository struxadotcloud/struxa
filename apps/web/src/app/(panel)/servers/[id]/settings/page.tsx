"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Copy, Terminal, Globe, ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { orpc, queryClient } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function StatRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
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
    <div className="rounded-xl border border-border bg-card shadow-sm">
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
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40 transition-colors">
      <div className="flex flex-col gap-0.5 max-w-xs">
        <span className="text-sm font-medium text-foreground">{label}</span>
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

function CustomSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex w-56 items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border/80 hover:bg-muted data-[popup-open]:border-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="shadow-md">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-green-500" : "bg-transparent"}`}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DebouncedInput({
  defaultValue,
  onSave,
  disabled,
  placeholder,
  className,
}: {
  defaultValue: string;
  onSave: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(v), 800);
  }

  return (
    <input
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

type SaveStatus = "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus | undefined }) {
  if (!status) return null;
  if (status === "saving") return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (status === "saved") return <span className="text-xs text-green-500">Saved</span>;
  return <span className="text-xs text-destructive">Error</span>;
}

function isBoolVariable(rules: string | null | undefined): boolean {
  return !!(rules && (rules.includes("in:0,1") || rules.includes("in:1,0")));
}

type ServerVariable = {
  variableId: string;
  variableValue: string | null;
  variable: {
    name: string;
    description: string | null;
    envVariable: string;
    defaultValue: string | null;
    userEditable: boolean;
    rules: string | null;
  };
};

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const [reinstallConfirm, setReinstallConfirm] = useState(false);
  const [nameStatus, setNameStatus] = useState<SaveStatus | undefined>(undefined);
  const [imageStatus, setImageStatus] = useState<SaveStatus | undefined>(undefined);
  const [varStatuses, setVarStatuses] = useState<Record<string, SaveStatus>>({});

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server, isPending: serverPending } = useQuery(
    orpc.servers.get.queryOptions({ input: { id } }),
  );

  const reinstallMutation = useMutation({
    ...orpc.servers.reinstall.mutationOptions(),
    onSuccess: () => setReinstallConfirm(false),
  });

  const renameMutation = useMutation(orpc.servers.rename.mutationOptions());
  const updateVariableMutation = useMutation(orpc.servers.updateStartupVariable.mutationOptions());
  const updateImageMutation = useMutation(orpc.servers.updateDockerImage.mutationOptions());

  async function saveImage(image: string) {
    setImageStatus("saving");
    try {
      await updateImageMutation.mutateAsync({ serverId: id, image });
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      setImageStatus("saved");
      setTimeout(() => setImageStatus(undefined), 2000);
    } catch {
      setImageStatus("error");
    }
  }

  async function saveServerName(name: string) {
    setNameStatus("saving");
    try {
      await renameMutation.mutateAsync({ serverId: id, name });
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      setNameStatus("saved");
      setTimeout(() => setNameStatus(undefined), 2000);
    } catch {
      setNameStatus("error");
    }
  }

  async function saveVariable(envVariable: string, value: string) {
    setVarStatuses((prev) => ({ ...prev, [envVariable]: "saving" }));
    try {
      await updateVariableMutation.mutateAsync({ serverId: id, envVariable, value });
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      setVarStatuses((prev) => ({ ...prev, [envVariable]: "saved" }));
      setTimeout(
        () =>
          setVarStatuses((prev) => {
            const next = { ...prev };
            delete next[envVariable];
            return next;
          }),
        2000,
      );
    } catch {
      setVarStatuses((prev) => ({ ...prev, [envVariable]: "error" }));
    }
  }

  if (isPending || !session) return <Loader />;
  if (serverPending) return <Loader />;

  const node = server?.node as { name?: string; fqdn?: string; daemonSFTP?: number } | undefined;
  const sftp = {
    host: node?.fqdn ?? "—",
    port: node?.daemonSFTP ?? 2022,
    username: `struxa.${server?.uuidShort ?? ""}`,
  };

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  const serverVars = (server?.serverVariables ?? []) as ServerVariable[];

  const egg = server?.egg as { name?: string; dockerImages?: string | null } | undefined;
  let dockerImageOptions: { tag: string; alias: string }[] = [];
  try {
    const parsed = JSON.parse(egg?.dockerImages ?? "{}") as Record<string, string>;
    dockerImageOptions = Object.entries(parsed).map(([tag, alias]) => ({ tag, alias }));
  } catch {}

  const currentImage = server?.image ?? "";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Game Servers
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Link href={`/servers/${id}`} className="text-muted-foreground transition-colors hover:text-foreground">
            {server?.name ?? id}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Settings</span>
        </div>
      </header>

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <SectionCard title="General" description="Basic server configuration.">
            <SettingRow label="Server Name" description="Displayed in the panel.">
              <div className="flex items-center gap-2">
                <DebouncedInput
                  defaultValue={server?.name ?? ""}
                  onSave={saveServerName}
                  className="w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring transition-colors"
                />
                <SaveIndicator status={nameStatus} />
              </div>
            </SettingRow>
            <SettingRow label="Docker Image" description="Container image used to run this server.">
              {dockerImageOptions.length > 1 ? (
                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={currentImage}
                    options={dockerImageOptions.map(({ tag, alias }) => ({ value: tag, label: alias || tag }))}
                    onChange={(image) => void saveImage(image)}
                    disabled={imageStatus === "saving"}
                  />
                  <SaveIndicator status={imageStatus} />
                </div>
              ) : (
                <span className="font-mono text-sm text-muted-foreground max-w-xs truncate">
                  {currentImage || "—"}
                </span>
              )}
            </SettingRow>
          </SectionCard>

          <SectionCard title="SFTP" description="Use these credentials to connect via any SFTP client. Your panel password is used for authentication.">
            <div className="grid grid-cols-3">
              {[
                { label: "Host", value: sftp.host, copy: sftp.host },
                { label: "Port", value: String(sftp.port), copy: null },
                { label: "Username", value: sftp.username, copy: sftp.username },
              ].map(({ label, value, copy: copyVal }, i) => (
                <div key={label} className={`px-4 py-3 ${i < 2 ? "border-r border-border" : ""}`}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{value}</span>
                    {copyVal && (
                      <button
                        type="button"
                        onClick={() => copy(copyVal)}
                        className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Startup" description="Server startup command and variables.">
            <div className="border-b border-border px-4 py-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Startup Command</p>
              <p className="font-mono text-xs text-foreground/70 leading-relaxed break-all">
                {server?.startup ?? "—"}
              </p>
            </div>
            {serverVars.map((sv) => {
              const isBool = isBoolVariable(sv.variable.rules);
              const currentValue = sv.variableValue ?? sv.variable.defaultValue ?? "0";

              if (isBool) {
                return (
                  <SettingRow
                    key={sv.variable.envVariable}
                    label={sv.variable.name}
                    description={sv.variable.description ?? undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={currentValue === "1"}
                        onChange={(v) => void saveVariable(sv.variable.envVariable, v ? "1" : "0")}
                        disabled={!sv.variable.userEditable || varStatuses[sv.variable.envVariable] === "saving"}
                      />
                      <SaveIndicator status={varStatuses[sv.variable.envVariable]} />
                      {!sv.variable.userEditable && !varStatuses[sv.variable.envVariable] && (
                        <span className="text-xs text-muted-foreground">read-only</span>
                      )}
                    </div>
                  </SettingRow>
                );
              }

              return (
                <SettingRow
                  key={sv.variable.envVariable}
                  label={sv.variable.name}
                  description={sv.variable.description ?? undefined}
                >
                  <div className="flex items-center gap-2">
                    {sv.variable.userEditable ? (
                      <DebouncedInput
                        defaultValue={currentValue}
                        onSave={(v) => void saveVariable(sv.variable.envVariable, v)}
                        placeholder={sv.variable.defaultValue ?? undefined}
                        className="w-36 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring transition-colors"
                      />
                    ) : (
                      <input
                        defaultValue={currentValue}
                        readOnly
                        className="w-36 rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-sm text-foreground outline-none opacity-60 cursor-default"
                      />
                    )}
                    <SaveIndicator status={varStatuses[sv.variable.envVariable]} />
                    {!sv.variable.userEditable && (
                      <span className="text-xs text-muted-foreground">read-only</span>
                    )}
                  </div>
                </SettingRow>
              );
            })}
          </SectionCard>

          <SectionCard title="Danger Zone" description="Irreversible actions that affect this server.">
            <SettingRow
              label="Reinstall Server"
              description="Reinstalls the server using the configured egg. Existing data may be overwritten."
            >
              {reinstallConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Are you sure?</span>
                  <button
                    type="button"
                    onClick={() => reinstallMutation.mutate({ serverId: id })}
                    disabled={reinstallMutation.isPending}
                    className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {reinstallMutation.isPending ? "Reinstalling…" : "Confirm"}
                  </button>
                  <button type="button" onClick={() => setReinstallConfirm(false)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReinstallConfirm(true)}
                  className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Reinstall
                </button>
              )}
            </SettingRow>
          </SectionCard>
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-y-auto">
            <StatRow icon={Server} label="Server ID">
              <span className="font-mono text-xs text-muted-foreground break-all">{server?.uuid ?? "—"}</span>
            </StatRow>
            <StatRow icon={Globe} label="Node">
              <span className="text-sm font-semibold text-foreground">{node?.name ?? "—"}</span>
            </StatRow>
            <StatRow icon={Server} label="Egg">
              <span className="text-sm font-semibold text-foreground">{(server?.egg as { name?: string } | undefined)?.name ?? "—"}</span>
            </StatRow>
            <StatRow icon={Terminal} label="SFTP Host">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{sftp.host}:{sftp.port}</span>
                <button
                  type="button"
                  onClick={() => copy(`${sftp.host}:${sftp.port}`)}
                  className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
