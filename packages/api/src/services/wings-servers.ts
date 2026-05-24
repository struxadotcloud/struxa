import { and, count, eq } from "drizzle-orm";
import { db } from "@struxa/db";
import {
  eggs,
  eggVariables,
  nodeAllocations,
  serverMounts,
  servers,
  serverVariables,
} from "@struxa/db";

export interface RawServer {
  settings: {
    uuid: string;
    meta: { name: string; description: string };
    suspended: boolean;
    invocation: string;
    skip_egg_scripts: boolean;
    environment: Record<string, unknown>;
    labels: Record<string, string>;
    backups: string[];
    schedules: unknown[];
    allocations: {
      force_outgoing_ip: boolean;
      default: { ip: string; port: number } | null;
      mappings: Record<string, number[]>;
    };
    build: {
      memory_limit: number;
      swap: number;
      disk_space: number;
      io_weight: number | null;
      cpu_limit: number;
      threads: string | null;
      oom_disabled: boolean;
    };
    mounts: Array<{ source: string; target: string; read_only: boolean }>;
    egg: { id: string; file_denylist: string[] };
    container: { image: string };
  };
  process_configuration: {
    startup: { done: string[] | null; strip_ansi: boolean };
    stop: { type: string; value: string | null };
    configs: unknown[];
  };
}

export interface PaginatedServersResponse {
  data: RawServer[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}

function parseProcessConfiguration(egg: { configStartup: string | null; configStop: string | null; configFiles: string | null; stopCommand?: string | null }): RawServer["process_configuration"] {
  let done: string[] | null = null;
  let stopType = "command";
  let stopValue: string | null = null;
  let configs: unknown[] = [];

  try {
    const startup = JSON.parse(egg.configStartup ?? "{}") as { done?: string | string[] };
    if (startup.done) {
      done = Array.isArray(startup.done) ? startup.done : [startup.done];
    }
  } catch {}

  try {
    const raw = egg.configStop ?? "{}";
    const parsed = JSON.parse(raw) as string | { type?: string; value?: string };
    if (typeof parsed === "string") {
      stopType = "command";
      stopValue = parsed || null;
    } else if (parsed && typeof parsed === "object") {
      stopType = parsed.type ?? "command";
      stopValue = parsed.value ?? null;
    }
  } catch {}

  if (stopValue === null && egg.stopCommand) {
    stopValue = egg.stopCommand;
  }

  try {
    const filesRaw = JSON.parse(egg.configFiles ?? "{}") as Record<string, {
      parser?: string;
      find?: Record<string, unknown>;
    }>;
    configs = Object.entries(filesRaw).map(([file, cfg]) => ({
      file,
      parser: cfg.parser ?? "file",
      create_new: true,
      replace: Object.entries(cfg.find ?? {}).map(([match, replace_with]) => ({
        match,
        replace_with,
        update_existing: true,
      })),
    }));
  } catch {}

  return {
    startup: { done, strip_ansi: false },
    stop: { type: stopType, value: stopValue },
    configs,
  };
}

async function buildServerConfig(
  server: typeof servers.$inferSelect,
): Promise<RawServer> {
  const [egg, allocation, serverVars, eggVars, mountRows] = await Promise.all([
    db.query.eggs.findFirst({ where: eq(eggs.id, server.eggId) }),
    db.query.nodeAllocations.findFirst({
      where: eq(nodeAllocations.id, server.allocationId),
    }),
    db.query.serverVariables.findMany({
      where: eq(serverVariables.serverId, server.id),
    }),
    db.query.eggVariables.findMany({
      where: eq(eggVariables.eggId, server.eggId),
    }),
    db.query.serverMounts.findMany({
      where: eq(serverMounts.serverId, server.id),
      with: { mount: true },
    }),
  ]);

  if (!egg || !allocation) {
    throw new Error(`Missing egg or allocation for server ${server.uuid}`);
  }

  const overrides = new Map(serverVars.map((sv) => [sv.variableId, sv.variableValue]));

  const environment: Record<string, string> = {};
  for (const eggVar of eggVars) {
    environment[eggVar.envVariable] =
      overrides.get(eggVar.id) ?? eggVar.defaultValue ?? "";
  }

  const denylist: string[] = [];
  try {
    const parsed = JSON.parse(egg.configFiles ?? "{}") as Record<string, { denylist?: string[] }>;
    for (const cfg of Object.values(parsed)) {
      if (Array.isArray(cfg.denylist)) denylist.push(...cfg.denylist);
    }
  } catch {}

  const mappings: Record<string, number[]> = {};
  mappings[allocation.ip] = [allocation.port];

  return {
    settings: {
      uuid: server.uuid,
      meta: {
        name: server.name,
        description: server.description ?? "",
      },
      suspended: server.suspended,
      invocation: server.invocation,
      skip_egg_scripts: server.skipScripts,
      environment,
      labels: {},
      backups: [],
      schedules: [],
      allocations: {
        force_outgoing_ip: false,
        default: { ip: allocation.ip, port: allocation.port },
        mappings,
      },
      build: {
        memory_limit: server.memory,
        swap: server.swap,
        disk_space: server.disk,
        io_weight: server.io ?? null,
        cpu_limit: server.cpu,
        threads: server.threads ?? null,
        oom_disabled: server.oomDisabled,
      },
      mounts: mountRows.map((sm) => ({
        source: sm.mount.source,
        target: sm.mount.target,
        read_only: sm.mount.readOnly,
      })),
      egg: { id: egg.uuid, file_denylist: denylist },
      container: { image: server.image },
    },
    process_configuration: parseProcessConfiguration(egg),
  };
}

export async function getServerConfig(
  serverUuid: string,
  nodeId: string,
): Promise<RawServer | null> {
  const server = await db.query.servers.findFirst({
    where: and(eq(servers.uuid, serverUuid), eq(servers.nodeId, nodeId)),
  });
  if (!server) return null;
  return buildServerConfig(server);
}

export async function getServerList(
  nodeId: string,
  page: number,
  perPage: number,
): Promise<PaginatedServersResponse> {
  const offset = (page - 1) * perPage;

  const [rows, totalResult] = await Promise.all([
    db.query.servers.findMany({
      where: eq(servers.nodeId, nodeId),
      limit: perPage,
      offset,
    }),
    db.select({ value: count() }).from(servers).where(eq(servers.nodeId, nodeId)),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + perPage, total);

  const data = await Promise.all(rows.map(buildServerConfig));

  return {
    data,
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      per_page: perPage,
      to,
      total,
    },
  };
}

export async function resetNodeServers(nodeId: string): Promise<void> {
  await db
    .update(servers)
    .set({ status: "" })
    .where(and(eq(servers.nodeId, nodeId), eq(servers.status, "installing")));
}

export async function getInstallScript(
  serverUuid: string,
  nodeId: string,
): Promise<{ container_image: string; entrypoint: string; script: string } | null> {
  const server = await db.query.servers.findFirst({
    where: and(eq(servers.uuid, serverUuid), eq(servers.nodeId, nodeId)),
  });
  if (!server) return null;

  const egg = await db.query.eggs.findFirst({ where: eq(eggs.id, server.eggId) });
  if (!egg) return null;

  const rawEntrypoint = egg.scriptEntry ?? "bash";
  const entrypoint = rawEntrypoint.trim().split(/\s+/)[0] || "bash";

  return {
    container_image: egg.scriptContainer ?? server.image,
    entrypoint,
    script: egg.scriptInstall ?? "",
  };
}

export async function completeInstall(
  serverUuid: string,
  nodeId: string,
  successful: boolean,
): Promise<boolean> {
  const server = await db.query.servers.findFirst({
    where: and(eq(servers.uuid, serverUuid), eq(servers.nodeId, nodeId)),
  });
  if (!server) return false;

  await db
    .update(servers)
    .set({ status: successful ? "" : "install_failed" })
    .where(eq(servers.id, server.id));

  return true;
}

export function buildInvocation(
  startup: string,
  variables: Record<string, string>,
): string {
  return startup.replace(/\{\{([^}]+)\}\}/g, (_, name: string) => variables[name] ?? "");
}
