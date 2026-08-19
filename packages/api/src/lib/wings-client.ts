import type { nodes } from "@struxa/db";
import { safeDecrypt } from "./crypto";

type NodeRecord = typeof nodes.$inferSelect;

interface CreateServerPayload {
  uuid: string;
  start_on_completion: boolean;
  environment: Record<string, string>;
  limits: {
    cpu: number;
    memory: number;
    disk: number;
    swap: number;
    io: number;
    threads: string | null;
    oom_disabled: boolean;
  };
  container: {
    image: string;
    oom_killer: boolean;
  };
}

interface BackupPayload {
  uuid: string;
  ignore: string;
  adapter: string;
}

class WingsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "WingsError";
  }
}

export class WingsClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(node: NodeRecord) {
    this.baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonListen}`;
    this.authHeader = `Bearer ${safeDecrypt(node.token)}`;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Struxa/1.0",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new WingsError(res.status, `Wings API error: ${res.status} ${path} — ${body}`);
    }
    return res;
  }

  async createServer(payload: CreateServerPayload): Promise<void> {
    await this.request("POST", "/api/servers", payload);
  }

  async deleteServer(uuid: string, options?: { purge?: boolean }): Promise<void> {
    await this.request("DELETE", `/api/servers/${uuid}`, options ?? {});
  }

  async sendPowerAction(
    uuid: string,
    action: "start" | "stop" | "restart" | "kill",
  ): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/power`, { action });
  }

  async reinstallServer(uuid: string): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/reinstall`, {});
  }

  async createBackup(uuid: string, payload: BackupPayload): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/backup`, payload);
  }

  async deleteBackup(uuid: string, backupUuid: string): Promise<void> {
    await this.request("DELETE", `/api/servers/${uuid}/backup/${backupUuid}`);
  }

  async restoreBackup(
    uuid: string,
    backupUuid: string,
    options?: {
      adapter?: string;
      download_url?: string;
      truncate_directory?: boolean;
    },
  ): Promise<void> {
    await this.request(
      "POST",
      `/api/servers/${uuid}/backup/${backupUuid}/restore`,
      {
        adapter: options?.adapter ?? "wings",
        ...(options?.download_url ? { download_url: options.download_url } : {}),
        truncate_directory: options?.truncate_directory ?? false,
      },
    );
  }

  async sendCommands(uuid: string, commands: string[]): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/commands`, { commands });
  }

  async getUtilization(): Promise<Record<string, { state: string }>> {
    const res = await this.request("GET", "/api/servers/utilization");
    return res.json() as Promise<Record<string, { state: string }>>;
  }

  async getSystemInfo(): Promise<{ version: string; docker_version: string }> {
    const res = await this.request("GET", "/api/system");
    return res.json() as Promise<{ version: string; docker_version: string }>;
  }
}

export function createWingsClient(node: NodeRecord): WingsClient {
  return new WingsClient(node);
}
