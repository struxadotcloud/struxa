import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { databaseHosts } from "@struxa/db";
import { encrypt, decrypt } from "../lib/crypto";
import { recordActivity } from "../services/activity";
import { adminProcedure, protectedProcedure } from "../index";

export const databaseHostsRouter = {
  listAvailable: protectedProcedure.handler(async () => {
    const rows = await db.select({ id: databaseHosts.id, name: databaseHosts.name, host: databaseHosts.host, port: databaseHosts.port }).from(databaseHosts);
    return rows;
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
        host: z.string().min(1).max(255),
        port: z.number().int().default(3306),
        username: z.string().min(1).max(100),
        password: z.string().min(1),
        maxDatabases: z.number().int().min(0).default(0),
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      await db.insert(databaseHosts).values({
        id,
        ...input,
        password: encrypt(input.password),
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
        host: z.string().min(1).max(255).optional(),
        port: z.number().int().optional(),
        username: z.string().min(1).max(100).optional(),
        password: z.string().min(1).optional(),
        maxDatabases: z.number().int().min(0).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, password, ...data } = input;
      await db
        .update(databaseHosts)
        .set({
          ...data,
          ...(password ? { password: encrypt(password) } : {}),
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

      const plainPassword = decrypt(host.password);
      try {
        const mysql = await import("mysql2/promise");
        const conn = await mysql.createConnection({
          host: host.host,
          port: host.port,
          user: host.username,
          password: plainPassword,
        });
        await conn.ping();
        await conn.end();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }),
};
