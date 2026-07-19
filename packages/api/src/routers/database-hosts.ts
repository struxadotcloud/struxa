import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { databaseHosts, databaseEngineTypes, servers, type DatabaseEngineType } from "@struxa/db";
import { encrypt, decrypt } from "../lib/crypto";
import { dbEngines } from "../lib/db-engines";
import { recordActivity } from "../services/activity";
import { adminProcedure, protectedProcedure } from "../index";

export const databaseHostsRouter = {
  listAvailableTypes: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
        with: { egg: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      const rawAllowed = server.egg?.allowedDatabaseTypes;
      const allowedTypes = rawAllowed ? (JSON.parse(rawAllowed) as DatabaseEngineType[]) : null;

      const rows = await db
        .select({ type: databaseHosts.type, allowedNodeIds: databaseHosts.allowedNodeIds })
        .from(databaseHosts);

      const eligible = rows.filter((r) => {
        if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(r.type)) return false;
        const nodeIds = r.allowedNodeIds ? (JSON.parse(r.allowedNodeIds) as string[]) : null;
        return !nodeIds || nodeIds.length === 0 || nodeIds.includes(server.nodeId);
      });

      return [...new Set(eligible.map((r) => r.type))];
    }),

  list: adminProcedure.handler(async () => {
    const rows = await db.select().from(databaseHosts);
    return rows.map((h) => ({ ...h, password: "***" }));
  }),

  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const host = await db.query.databaseHosts.findFirst({
        where: eq(databaseHosts.id, input.id),
      });
      if (!host) throw new ORPCError("NOT_FOUND");
      return { ...host, password: "***" };
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(databaseEngineTypes).default("mysql"),
        host: z.string().min(1).max(255),
        port: z.number().int().default(3306),
        username: z.string().min(1).max(100),
        password: z.string().min(1),
        ssl: z.boolean().default(false),
        maxDatabases: z.number().int().min(0).default(0),
        allowedNodeIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { allowedNodeIds, ...rest } = input;
      const id = randomUUID();
      await db.insert(databaseHosts).values({
        id,
        ...rest,
        password: encrypt(input.password),
        allowedNodeIds: allowedNodeIds?.length ? JSON.stringify(allowedNodeIds) : null,
      });
      const host = await db.query.databaseHosts.findFirst({
        where: eq(databaseHosts.id, id),
      });
      recordActivity({ eventType: "admin:database-host.create", userId: context.session.user.id, ip: context.ip, properties: { name: input.name } });
      return { ...host!, password: "***" };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        type: z.enum(databaseEngineTypes).optional(),
        host: z.string().min(1).max(255).optional(),
        port: z.number().int().optional(),
        username: z.string().min(1).max(100).optional(),
        password: z.string().min(1).optional(),
        ssl: z.boolean().optional(),
        maxDatabases: z.number().int().min(0).optional(),
        allowedNodeIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, password, allowedNodeIds, ...data } = input;
      await db
        .update(databaseHosts)
        .set({
          ...data,
          ...(password ? { password: encrypt(password) } : {}),
          ...(allowedNodeIds !== undefined
            ? { allowedNodeIds: allowedNodeIds.length ? JSON.stringify(allowedNodeIds) : null }
            : {}),
        })
        .where(eq(databaseHosts.id, id));
      const host = await db.query.databaseHosts.findFirst({
        where: eq(databaseHosts.id, id),
      });
      recordActivity({ eventType: "admin:database-host.update", userId: context.session.user.id, ip: context.ip, properties: { name: host?.name } });
      return { ...host!, password: "***" };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const host = await db.query.databaseHosts.findFirst({ where: eq(databaseHosts.id, input.id) });
      await db.delete(databaseHosts).where(eq(databaseHosts.id, input.id));
      recordActivity({ eventType: "admin:database-host.delete", userId: context.session.user.id, ip: context.ip, properties: { name: host?.name } });
    }),

  testConnection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const host = await db.query.databaseHosts.findFirst({
        where: eq(databaseHosts.id, input.id),
      });
      if (!host) throw new ORPCError("NOT_FOUND");

      return dbEngines[host.type].testConnection({
        host: host.host,
        port: host.port,
        username: host.username,
        password: decrypt(host.password),
        ssl: host.ssl,
      });
    }),
};
