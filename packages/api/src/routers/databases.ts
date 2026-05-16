import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { databaseHosts, serverDatabases, servers } from "@struxa/db";
import { encrypt, decrypt } from "../lib/crypto";
import { protectedProcedure } from "../index";

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
        hostId: z.string().uuid(),
        database: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/),
        remote: z.string().default("%"),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      const host = await db.query.databaseHosts.findFirst({
        where: eq(databaseHosts.id, input.hostId),
      });
      if (!host) throw new ORPCError("NOT_FOUND", { message: "Database host not found" });

      const dbName = `s${server.uuidShort}_${input.database}`;
      const username = `u${server.uuidShort}_${input.database}`.slice(0, 32);
      const password = generatePassword();

      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host: host.host,
        port: host.port,
        user: host.username,
        password: decrypt(host.password),
      });

      try {
        await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await conn.execute(
          `CREATE USER IF NOT EXISTS '${username}'@'${input.remote}' IDENTIFIED BY ?`,
          [password],
        );
        await conn.execute(
          `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${username}'@'${input.remote}'`,
        );
        await conn.execute("FLUSH PRIVILEGES");
      } finally {
        await conn.end();
      }

      const id = randomUUID();
      const uuid = randomUUID();
      await db.insert(serverDatabases).values({
        id,
        uuid,
        serverId: input.serverId,
        hostId: input.hostId,
        database: dbName,
        username,
        remote: input.remote,
        password: encrypt(password),
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
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host: dbRecord.host.host,
        port: dbRecord.host.port,
        user: dbRecord.host.username,
        password: decrypt(dbRecord.host.password),
      });

      try {
        await conn.execute(
          `ALTER USER '${dbRecord.username}'@'${dbRecord.remote}' IDENTIFIED BY ?`,
          [newPassword],
        );
        await conn.execute("FLUSH PRIVILEGES");
      } finally {
        await conn.end();
      }

      await db
        .update(serverDatabases)
        .set({ password: encrypt(newPassword) })
        .where(eq(serverDatabases.id, input.databaseId));

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

      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host: dbRecord.host.host,
        port: dbRecord.host.port,
        user: dbRecord.host.username,
        password: decrypt(dbRecord.host.password),
      });

      try {
        await conn.execute(
          `DROP USER IF EXISTS '${dbRecord.username}'@'${dbRecord.remote}'`,
        );
        await conn.execute(`DROP DATABASE IF EXISTS \`${dbRecord.database}\``);
        await conn.execute("FLUSH PRIVILEGES");
      } finally {
        await conn.end();
      }

      await db
        .delete(serverDatabases)
        .where(eq(serverDatabases.id, input.databaseId));
    }),
};
