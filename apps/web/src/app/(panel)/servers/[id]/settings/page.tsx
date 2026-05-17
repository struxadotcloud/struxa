"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Copy, Terminal, Globe, ChevronDown } from "lucide-react";
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
    <div className="flex flex-col border-b border-[#222222]">
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#555555]">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="border-b border-[#222222] px-4 py-2 bg-[#0d0d0d]">
      <span className="text-[10px] uppercase tracking-widest text-[#444444]">{label}</span>
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
    <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3 hover:bg-[#0d0d0d] transition-colors">
      <div className="flex flex-col gap-0.5 max-w-sm">
        <span className="text-sm text-white">{label}</span>
        {description && <span className="text-xs text-[#555555]">{description}</span>}
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
        checked ? "bg-[#22c55e]" : "bg-[#333333]"
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
        className="flex w-64 items-center justify-between border border-[#333333] bg-[#141414] px-3 py-1.5 font-mono text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 font-mono text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-[#22c55e]" : "bg-transparent"}`}
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
  if (status === "saving") return <span className="text-xs text-[#555555]">Saving…</span>;
  if (status === "saved") return <span className="text-xs text-[#22c55e]">Saved</span>;
  return <span className="text-xs text-[#f43f5e]">Error</span>;
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${id}`} className="text-[#555555] transition-colors hover:text-white">
            {server?.name ?? id}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Settings</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <SectionHeader label="General" />
          <SettingRow label="Server Name" description="Displayed in the panel.">
            <div className="flex items-center gap-2">
              <DebouncedInput
                defaultValue={server?.name ?? ""}
                onSave={saveServerName}
                className="w-52 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none font-mono focus:border-[#555555] transition-colors"
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
              <span className="font-mono text-sm text-[#888888] max-w-xs truncate">
                {currentImage || "—"}
              </span>
            )}
          </SettingRow>

          <SectionHeader label="SFTP" />
          <div className="border-b border-[#222222] px-4 py-2">
            <p className="text-xs text-[#555555]">
              Use these credentials to connect via any SFTP client. Your panel password is used for authentication.
            </p>
          </div>
          <div className="grid grid-cols-3 border-l border-[#222222]">
            <div className="border-r border-b border-[#222222] px-4 py-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Host</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{sftp.host}</span>
                <button type="button" onClick={() => copy(sftp.host)} className="text-[#444444] hover:text-white transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="border-r border-b border-[#222222] px-4 py-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Port</p>
              <span className="font-mono text-sm text-white">{sftp.port}</span>
            </div>
            <div className="border-b border-[#222222] px-4 py-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Username</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{sftp.username}</span>
                <button type="button" onClick={() => copy(sftp.username)} className="text-[#444444] hover:text-white transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <SectionHeader label="Startup" />
          <div className="border-b border-[#222222] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Startup Command</p>
            <p className="font-mono text-xs text-[#888888] leading-relaxed break-all">
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
                      <span className="text-[10px] text-[#444444]">read-only</span>
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
                      className="w-40 bg-[#141414] border border-[#333333] px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555] transition-colors"
                    />
                  ) : (
                    <input
                      defaultValue={currentValue}
                      readOnly
                      className="w-40 bg-[#141414] border border-[#333333] px-2 py-1.5 font-mono text-sm text-white outline-none opacity-70 cursor-default"
                    />
                  )}
                  <SaveIndicator status={varStatuses[sv.variable.envVariable]} />
                  {!sv.variable.userEditable && (
                    <span className="text-[10px] text-[#444444]">read-only</span>
                  )}
                </div>
              </SettingRow>
            );
          })}

          <SectionHeader label="Danger Zone" />
          <SettingRow
            label="Reinstall Server"
            description="This will reinstall the server using the configured egg. Existing data may be overwritten."
          >
            {reinstallConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#888888]">Are you sure?</span>
                <button
                  type="button"
                  onClick={() => reinstallMutation.mutate({ serverId: id })}
                  disabled={reinstallMutation.isPending}
                  className="px-3 py-1 text-sm font-medium border border-[#555555] text-[#888888] hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {reinstallMutation.isPending ? "Reinstalling…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setReinstallConfirm(false)} className="text-xs text-[#555555] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReinstallConfirm(true)}
                className="px-4 py-1.5 text-sm font-medium border border-[#555555]/50 text-[#888888] hover:border-[#555555] transition-colors"
              >
                Reinstall
              </button>
            )}
          </SettingRow>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Server} label="SERVER ID">
            <span className="font-mono text-xs font-bold text-[#888888] break-all">{server?.uuid ?? "—"}</span>
          </StatRow>
          <StatRow icon={Globe} label="NODE">
            <span className="font-mono text-sm font-bold text-white">{node?.name ?? "—"}</span>
          </StatRow>
          <StatRow icon={Server} label="EGG">
            <span className="text-sm font-bold text-white">{(server?.egg as { name?: string } | undefined)?.name ?? "—"}</span>
          </StatRow>
          <StatRow icon={Terminal} label="SFTP HOST">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{sftp.host}:{sftp.port}</span>
              <button type="button" onClick={() => copy(`${sftp.host}:${sftp.port}`)} className="shrink-0 text-[#444444] hover:text-white transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
