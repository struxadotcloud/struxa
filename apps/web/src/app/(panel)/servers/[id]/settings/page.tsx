"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Copy, Terminal, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockServerVariables } from "@/lib/mock-data";
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
  const [unsaved, setUnsaved] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];

  const sftp = {
    host: `sftp.eu-west-1a.struxa.host`,
    port: 2022,
    username: `struxa.${server.id}`,
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${server.id}`} className="text-[#555555] transition-colors hover:text-white">
            {server.name}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Settings</span>
        </div>
        <button
          type="button"
          disabled={!unsaved}
          className="px-4 py-1.5 text-sm font-medium bg-[#f59e0b] text-black enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          Save Changes
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <SectionHeader label="General" />
          <SettingRow label="Server Name" description="Displayed in the panel. Does not affect the in-game name.">
            <input
              defaultValue={server.name}
              onChange={() => setUnsaved(true)}
              className="w-52 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555555] font-mono"
            />
          </SettingRow>
          <SettingRow label="Docker Image" description="Container image used to run this server.">
            <select
              className="w-64 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
              onChange={() => setUnsaved(true)}
            >
              <option>ghcr.io/pterodactyl/yolks:java_21</option>
              <option>ghcr.io/pterodactyl/yolks:java_17</option>
              <option>ghcr.io/pterodactyl/yolks:java_11</option>
            </select>
          </SettingRow>

          <SectionHeader label="SFTP" />
          <div className="border-b border-[#222222] px-4 py-3 bg-[#0a0a0a]">
            <p className="mb-3 text-xs text-[#555555]">
              Use these credentials to connect via any SFTP client (FileZilla, WinSCP, etc.).
              Your panel password is used for authentication.
            </p>
            <div className="grid grid-cols-3 gap-0 border-l border-t border-[#222222]">
              <div className="border-b border-r border-[#222222] px-3 py-3">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Host</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">{sftp.host}</span>
                  <button type="button" className="text-[#444444] hover:text-white transition-colors">
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
                  <button type="button" className="text-[#444444] hover:text-white transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <SectionHeader label="Startup" />
          <div className="border-b border-[#222222] px-4 py-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444444]">Startup Command</p>
            <p className="font-mono text-xs text-[#888888] leading-relaxed">
              java -Xms128M -Xmx{`{{SERVER_MEMORY}}`}M -jar {`{{SERVER_JARFILE}}`} nogui
            </p>
          </div>
          {mockServerVariables.map((variable) => (
            <SettingRow
              key={variable.envVar}
              label={variable.name}
              description={variable.description}
            >
              <input
                defaultValue={variable.value}
                onChange={() => setUnsaved(true)}
                className="w-40 bg-[#141414] border border-[#333333] px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
              />
            </SettingRow>
          ))}

          <SectionHeader label="Danger Zone" />
          <SettingRow
            label="Reinstall Server"
            description="This will reinstall the server using the configured egg. Existing data may be overwritten."
          >
            <button
              type="button"
              className="px-4 py-1.5 text-sm font-medium border border-[#f59e0b]/50 text-[#f59e0b] hover:border-[#f59e0b] transition-colors"
            >
              Reinstall
            </button>
          </SettingRow>
          <SettingRow
            label="Delete Server"
            description="Permanently deletes this server and all associated data. This action cannot be undone."
          >
            <button
              type="button"
              className="px-4 py-1.5 text-sm font-medium bg-[#f43f5e] text-white hover:opacity-80 transition-opacity"
            >
              Delete Server
            </button>
          </SettingRow>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Server} label="SERVER ID">
            <span className="font-mono text-sm font-bold text-[#888888]">{server.id}</span>
          </StatRow>
          <StatRow icon={Globe} label="NODE">
            <span className="font-mono text-sm font-bold text-white">{server.node}</span>
          </StatRow>
          <StatRow icon={Server} label="GAME">
            <span className="text-2xl font-bold text-white capitalize">{server.game}</span>
          </StatRow>
          <StatRow icon={Terminal} label="SFTP HOST">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{sftp.host}:{sftp.port}</span>
              <button type="button" className="shrink-0 text-[#444444] hover:text-white transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
