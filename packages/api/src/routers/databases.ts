import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { databaseEngineTypes, databaseHosts, serverDatabases, servers, type DatabaseEngineType } from "@struxa/db";
import { encrypt, decrypt } from "../lib/crypto";
import { dbEngines } from "../lib/db-engines";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

const usernameMaxLength: Record<DatabaseEngineType, number> = {
  mysql: 32,
  mariadb: 32,
  postgresql: 63,
  mongodb: 63,
  redis: 63,
};

const databaseNameMaxLength: Record<DatabaseEngineType, number> = {
  mysql: 64,
  mariadb: 64,
  postgresql: 63,
  mongodb: 64,
  redis: 64,
};

function randomIndex(length: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0]! % length;
}

function generatePassword(length = 24): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

export const databasesRouter = {
  list: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      const rows = await db.query.serverDatabases.findMany({
        where: eq(serverDatabases.serverId, input.serverId),
        with: { host: true },
      });

      return rows.map((r) => ({
        ...r,
        password: decrypt(r.password),
        host: { ...r.host, password: undefined },
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        type: z.enum(databaseEngineTypes),
        database: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/),
        remote: z.string().max(15).regex(/^[a-zA-Z0-9%_.:-]+$/).optional(),
      }),
    )
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
      const allowed = rawAllowed ? (JSON.parse(rawAllowed) as DatabaseEngineType[]) : null;
      if (allowed && allowed.length > 0 && !allowed.includes(input.type)) {
        throw new ORPCError("FORBIDDEN", { message: "Database engine not allowed for this egg" });
      }

      const candidates = await db.query.databaseHosts.findMany({
        where: eq(databaseHosts.type, input.type),
      });
      const eligible = candidates.filter((h) => {
        const nodeIds = h.allowedNodeIds ? (JSON.parse(h.allowedNodeIds) as string[]) : null;
        return !nodeIds || nodeIds.length === 0 || nodeIds.includes(server.nodeId);
      });
      if (eligible.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "No available database host for this engine" });
      }
      const host = eligible[randomIndex(eligible.length)]!;

      const remote = host.type === "mysql" || host.type === "mariadb" ? (input.remote ?? "%") : undefined;
      const dbName = `s${server.uuidShort}_${input.database}`.slice(0, databaseNameMaxLength[host.type]);
      const username = `u${server.uuidShort}_${input.database}`.slice(0, usernameMaxLength[host.type]);
      const password = generatePassword();

      await dbEngines[host.type].createDatabase(
        { host: host.host, port: host.port, username: host.username, password: decrypt(host.password), ssl: host.ssl },
        { database: dbName, username, password, remote },
      );

      const id = randomUUID();
      const uuid = randomUUID();
      await db.insert(serverDatabases).values({
        id,
        uuid,
        serverId: input.serverId,
        hostId: host.id,
        database: dbName,
        username,
        remote,
        password: encrypt(password),
      });

      recordActivity({
        eventType: "server:database.create",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { database: dbName },
      });

      return db.query.serverDatabases.findFirst({
        where: eq(serverDatabases.id, id),
        with: { host: true },
      });
    }),

  rotatePassword: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), databaseId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      const dbRecord = await db.query.serverDatabases.findFirst({
        where: and(
          eq(serverDatabases.id, input.databaseId),
          eq(serverDatabases.serverId, input.serverId),
        ),
        with: { host: true },
      });
      if (!dbRecord) throw new ORPCError("NOT_FOUND");

      const newPassword = generatePassword();
      await dbEngines[dbRecord.host.type].rotatePassword(
        {
          host: dbRecord.host.host,
          port: dbRecord.host.port,
          username: dbRecord.host.username,
          password: decrypt(dbRecord.host.password),
          ssl: dbRecord.host.ssl,
        },
        { username: dbRecord.username, newPassword, remote: dbRecord.remote ?? undefined, database: dbRecord.database },
      );

      await db
        .update(serverDatabases)
        .set({ password: encrypt(newPassword) })
        .where(eq(serverDatabases.id, input.databaseId));

      recordActivity({
        eventType: "server:database.rotate-password",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { database: dbRecord.database },
      });

      return { password: newPassword };
    }),

  delete: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), databaseId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      const dbRecord = await db.query.serverDatabases.findFirst({
        where: and(
          eq(serverDatabases.id, input.databaseId),
          eq(serverDatabases.serverId, input.serverId),
        ),
        with: { host: true },
      });
      if (!dbRecord) throw new ORPCError("NOT_FOUND");

      await dbEngines[dbRecord.host.type].dropDatabase(
        {
          host: dbRecord.host.host,
          port: dbRecord.host.port,
          username: dbRecord.host.username,
          password: decrypt(dbRecord.host.password),
          ssl: dbRecord.host.ssl,
        },
        { database: dbRecord.database, username: dbRecord.username, remote: dbRecord.remote ?? undefined },
      );

      await db
        .delete(serverDatabases)
        .where(eq(serverDatabases.id, input.databaseId));

      recordActivity({
        eventType: "server:database.delete",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { database: dbRecord.database },
      });
    }),
};
