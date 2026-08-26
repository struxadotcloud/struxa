import { randomBytes, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { nodes } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { getEffectiveAppUrl } from "../services/instance";
import { encrypt, safeDecrypt } from "../lib/crypto";
import { signWsToken } from "../lib/jwt";
import { buildWingsConfigYaml } from "../lib/wings-config";
import { adminProcedure } from "../index";

let _latestWingsVersion: { data: string | null; expiresAt: number } | null = null;

export const nodesRouter = {
  list: adminProcedure.handler(async () => {
    return db.select().from(nodes);
  }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        locationId: z.string().uuid(),
        fqdn: z.string().min(1).max(255),
        scheme: z.enum(["https", "http"]).default("https"),
        memory: z.number().int().min(1),
        memoryOverallocate: z.number().int().min(0).default(0),
        disk: z.number().int().min(1),
        diskOverallocate: z.number().int().min(0).default(0),
        uploadSize: z.number().int().min(1).default(100),
        daemonListen: z.number().int().default(8080),
        daemonSFTP: z.number().int().default(2022),
        daemonBase: z.string().default("/var/lib/pterodactyl"),
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      const uuid = randomUUID();
      const tokenId = randomUUID();
      const token = randomBytes(32).toString("hex");

      await db.insert(nodes).values({
        id,
        uuid,
        tokenId,
        token: encrypt(token),
        ...input,
      });

      recordActivity({ eventType: "admin:node.create", userId: context.session.user.id, nodeId: id, ip: context.ip, properties: { name: input.name } });

      return db.query.nodes.findFirst({ where: eq(nodes.id, id) });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        fqdn: z.string().min(1).max(255).optional(),
        scheme: z.enum(["https", "http"]).optional(),
        memory: z.number().int().min(1).optional(),
        memoryOverallocate: z.number().int().min(0).optional(),
        disk: z.number().int().min(1).optional(),
        diskOverallocate: z.number().int().min(0).optional(),
        uploadSize: z.number().int().min(1).optional(),
        daemonListen: z.number().int().optional(),
        daemonSFTP: z.number().int().optional(),
        daemonBase: z.string().optional(),
        maintenanceMode: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      await db.update(nodes).set(data).where(eq(nodes.id, id));
      const node = await db.query.nodes.findFirst({ where: eq(nodes.id, id) });

      let wingsUpdated = false;
      if (node) {
        try {
          const res = await fetch(
            `${node.scheme}://${node.fqdn}:${node.daemonListen}/api/update`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${safeDecrypt(node.token)}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                api: {
                  port: node.daemonListen,
                  ssl: { enabled: node.scheme === "https" },
                  upload_limit: node.uploadSize,
                },
                system: {
                  sftp: { bind_port: node.daemonSFTP },
                },
              }),
              signal: AbortSignal.timeout(5000),
            },
          );
          wingsUpdated = res.ok;
        } catch {
          // Wings unreachable — DB update already succeeded
        }
      }

      recordActivity({ eventType: "admin:node.update", userId: context.session.user.id, nodeId: id, ip: context.ip, properties: { name: node?.name } });

      return { node, wingsUpdated };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const node = await db.query.nodes.findFirst({ where: eq(nodes.id, input.id) });
      await db.delete(nodes).where(eq(nodes.id, input.id));
      recordActivity({ eventType: "admin:node.delete", userId: context.session.user.id, nodeId: input.id, ip: context.ip, properties: { name: node?.name } });
    }),

  regenerateToken: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const node = await db.query.nodes.findFirst({ where: eq(nodes.id, input.id) });
      const tokenId = randomUUID();
      const token = randomBytes(32).toString("hex");
      await db.update(nodes).set({ tokenId, token: encrypt(token) }).where(eq(nodes.id, input.id));
      recordActivity({ eventType: "admin:node.token-regenerate", userId: context.session.user.id, nodeId: input.id, ip: context.ip, properties: { name: node?.name } });
      return { tokenId, token };
    }),

  getStatsSocket: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const node = await db.query.nodes.findFirst({ where: eq(nodes.id, input.id) });
      if (!node) throw new ORPCError("NOT_FOUND");

      const token = await signWsToken(
        { user_uuid: context.session.user.id, server_uuid: node.uuid, permissions: ["*"] },
        safeDecrypt(node.token),
      );

      const wsScheme = node.scheme === "https" ? "wss" : "ws";
      return { token, socket: `${wsScheme}://${node.fqdn}:${node.daemonListen}/api/system/stats/ws` };
    }),

  getLatestWingsVersion: adminProcedure.handler(async () => {
    if (_latestWingsVersion && Date.now() < _latestWingsVersion.expiresAt) return _latestWingsVersion.data;

    const cache = (data: string | null, ttlMs: number) => {
      _latestWingsVersion = { data, expiresAt: Date.now() + ttlMs };
      return data;
    };

    try {
      const res = await fetch("https://api.github.com/repos/struxadotcloud/wings/releases/latest", {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return cache(null, 5 * 60 * 1000);
      const json = (await res.json()) as { tag_name?: string };
      return cache(json.tag_name ?? null, 60 * 60 * 1000);
    } catch {
      return cache(null, 5 * 60 * 1000);
    }
  }),

  getDeploymentConfig: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const node = await db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
      });
      if (!node) return null;

      const appUrl = await getEffectiveAppUrl();

      return { yaml: buildWingsConfigYaml(node, appUrl) };
    }),

};
