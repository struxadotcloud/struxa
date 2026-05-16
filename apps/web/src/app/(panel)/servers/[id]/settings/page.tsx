"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Copy, Terminal, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { orpc } from "@/utils/orpc";
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

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const [reinstallConfirm, setReinstallConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const deleteMutation = useMutation({
    ...orpc.servers.delete.mutationOptions(),
    onSuccess: () => router.replace("/"),
  });

  if (isPending || !session) return <Loader />;
  if (serverPending) return <Loader />;

  const isAdmin = session.user.role === "admin";

  const node = server?.node as { name?: string; fqdn?: string; daemonSFTP?: number } | undefined;
  const sftp = {
    host: node?.fqdn ?? "—",
    port: node?.daemonSFTP ?? 2022,
    username: `struxa.${server?.uuidShort ?? ""}`,
  };

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  const serverVars = (server?.serverVariables ?? []) as Array<{
    variableValue: string;
    variable: { name: string; description: string | null; envVariable: string };
  }>;

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
            <input
              defaultValue={server?.name ?? ""}
              readOnly
              className="w-52 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none font-mono opacity-70 cursor-default"
            />
          </SettingRow>
          <SettingRow label="Docker Image" description="Container image used to run this server.">
            <span className="font-mono text-sm text-[#888888] max-w-xs truncate">{server?.image ?? "—"}</span>
          </SettingRow>

          <SectionHeader label="SFTP" />
          <div className="border-b border-[#222222] px-4 py-3 bg-[#0a0a0a]">
            <p className="mb-3 text-xs text-[#555555]">
              Use these credentials to connect via any SFTP client. Your panel password is used for authentication.
            </p>
            <div className="grid grid-cols-3 gap-0 border-l border-t border-[#222222]">
              <div className="border-b border-r border-[#222222] px-3 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Host</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{sftp.host}</span>
                  <button type="button" onClick={() => copy(sftp.host)} className="text-[#444444] hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="border-b border-r border-[#222222] px-3 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Port</p>
                <span className="font-mono text-sm text-white">{sftp.port}</span>
              </div>
              <div className="border-b border-[#222222] px-3 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Username</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{sftp.username}</span>
                  <button type="button" onClick={() => copy(sftp.username)} className="text-[#444444] hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
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
          {serverVars.map((sv) => (
            <SettingRow
              key={sv.variable.envVariable}
              label={sv.variable.name}
              description={sv.variable.description ?? undefined}
            >
              <input
                defaultValue={sv.variableValue}
                readOnly
                className="w-40 bg-[#141414] border border-[#333333] px-2 py-1.5 font-mono text-sm text-white outline-none opacity-70 cursor-default"
              />
            </SettingRow>
          ))}

          <SectionHeader label="Danger Zone" />
          <SettingRow
            label="Reinstall Server"
            description="This will reinstall the server using the configured egg. Existing data may be overwritten."
          >
            {reinstallConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#f59e0b]">Are you sure?</span>
                <button
                  type="button"
                  onClick={() => reinstallMutation.mutate({ serverId: id })}
                  disabled={reinstallMutation.isPending}
                  className="px-3 py-1 text-sm font-medium border border-[#f59e0b] text-[#f59e0b] hover:opacity-80 disabled:opacity-40 transition-opacity"
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
                className="px-4 py-1.5 text-sm font-medium border border-[#f59e0b]/50 text-[#f59e0b] hover:border-[#f59e0b] transition-colors"
              >
                Reinstall
              </button>
            )}
          </SettingRow>
          {isAdmin && (
            <SettingRow
              label="Delete Server"
              description="Permanently deletes this server and all associated data. This action cannot be undone."
            >
              {deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#f43f5e]">Are you sure?</span>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate({ id, purgeData: false })}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 text-sm font-medium bg-[#f43f5e] text-white hover:opacity-80 disabled:opacity-40 transition-opacity"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
                  </button>
                  <button type="button" onClick={() => setDeleteConfirm(false)} className="text-xs text-[#555555] hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="px-4 py-1.5 text-sm font-medium bg-[#f43f5e] text-white hover:opacity-80 transition-opacity"
                >
                  Delete Server
                </button>
              )}
            </SettingRow>
          )}
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
