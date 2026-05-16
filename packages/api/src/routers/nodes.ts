import { randomBytes, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { nodes } from "@struxa/db";
import { adminProcedure } from "../index";
import { env } from "@struxa/env/server";

export const nodesRouter = {
  list: adminProcedure.handler(async () => {
    return db.select().from(nodes);
  }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
        with: { allocations: true },
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
    .handler(async ({ input }) => {
      const id = randomUUID();
      const uuid = randomUUID();
      const tokenId = randomUUID();
      const token = randomBytes(32).toString("hex");

      await db.insert(nodes).values({
        id,
        uuid,
        tokenId,
        token,
        ...input,
      });

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
    .handler(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(nodes).set(data).where(eq(nodes.id, id));
      return db.query.nodes.findFirst({ where: eq(nodes.id, id) });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(nodes).where(eq(nodes.id, input.id));
    }),

  regenerateToken: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const tokenId = randomUUID();
      const token = randomBytes(32).toString("hex");
      await db.update(nodes).set({ tokenId, token }).where(eq(nodes.id, input.id));
      return { tokenId, token };
    }),

  getDeploymentConfig: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const node = await db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
      });
      if (!node) return null;

      return {
        yaml: [
          `debug: false`,
          `uuid: ${node.uuid}`,
          `token_id: ${node.tokenId}`,
          `token: ${node.token}`,
          `api:`,
          `  host: 0.0.0.0`,
          `  port: ${node.daemonListen}`,
          `  ssl:`,
          `    enabled: ${node.scheme === "https"}`,
          `system:`,
          `  data: ${node.daemonBase}`,
          `  sftp:`,
          `    bind_port: ${node.daemonSFTP}`,
          `remote: ${env.APP_URL}`,
        ].join("\n"),
      };
    }),

  testConnection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const node = await db.query.nodes.findFirst({
        where: eq(nodes.id, input.id),
      });
      if (!node) return { online: false };

      const port = node.daemonListen || 8080;
      const url = `${node.scheme}://${node.fqdn}:${port}/api/system`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${node.tokenId}.${node.token}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) return { online: false };
        const data = await res.json() as { version?: string };
        return { online: true, version: data.version ?? "unknown" };
      } catch {
        return { online: false };
      }
    }),
};
