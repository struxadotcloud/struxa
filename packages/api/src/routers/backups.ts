import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { backups, nodes, servers, subusers } from "@struxa/db";
import { createWingsClient } from "../lib/wings-client";
import { safeDecrypt } from "../lib/crypto";
import { signBackupDownloadToken } from "../lib/jwt";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

async function requireServerAccess(userId: string, serverId: string, role: string | null | undefined) {
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
    with: { node: true },
  });
  if (!server) throw new ORPCError("NOT_FOUND");
  if (role !== "admin" && server.userId !== userId) {
    const sub = await db.query.subusers.findFirst({
      where: and(eq(subusers.userId, userId), eq(subusers.serverId, serverId)),
    });
    if (!sub) throw new ORPCError("FORBIDDEN");
  }
  return server;
}

export const backupsRouter = {
  list: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);
      return db.query.backups.findMany({
        where: eq(backups.serverId, input.serverId),
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        name: z.string().min(1).max(255),
        ignoredFiles: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await requireServerAccess(
        context.session.user.id,
        input.serverId,
        context.session.user.role,
      );

      const id = randomUUID();
      const uuid = randomUUID();

      await db.insert(backups).values({
        id,
        uuid,
        serverId: input.serverId,
        name: input.name,
        ignoredFiles: input.ignoredFiles ?? null,
      });

      const client = createWingsClient(server.node as typeof nodes.$inferSelect);
      await client.createBackup(server.uuid, {
        uuid,
        ignore: input.ignoredFiles ?? "",
        adapter: "wings",
      });

      recordActivity({
        eventType: "server:backup.start",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: input.name },
      });

      return db.query.backups.findFirst({ where: eq(backups.id, id) });
    }),

  delete: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), backupId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await requireServerAccess(
        context.session.user.id,
        input.serverId,
        context.session.user.role,
      );

      const backup = await db.query.backups.findFirst({
        where: and(eq(backups.id, input.backupId), eq(backups.serverId, input.serverId)),
      });
      if (!backup) throw new ORPCError("NOT_FOUND");
      if (backup.isLocked) throw new ORPCError("BAD_REQUEST", { message: "Backup is locked" });

      const client = createWingsClient(server.node as typeof nodes.$inferSelect);
      await client.deleteBackup(server.uuid, backup.uuid);

      await db.delete(backups).where(eq(backups.id, input.backupId));

      recordActivity({
        eventType: "server:backup.delete",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: backup.name },
      });
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), backupId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await requireServerAccess(
        context.session.user.id,
        input.serverId,
        context.session.user.role,
      );

      const backup = await db.query.backups.findFirst({
        where: and(eq(backups.id, input.backupId), eq(backups.serverId, input.serverId)),
      });
      if (!backup || !backup.isSuccessful) throw new ORPCError("NOT_FOUND");

      const node = server.node as typeof nodes.$inferSelect;
      const token = await signBackupDownloadToken(
        context.session.user.id,
        server.uuid,
        backup.uuid,
        safeDecrypt(node.token),
      );
      const url = `${node.scheme}://${node.fqdn}:${node.daemonListen}/download/backup?token=${token}`;
      return { url };
    }),

  restore: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), backupId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await requireServerAccess(
        context.session.user.id,
        input.serverId,
        context.session.user.role,
      );

      const backup = await db.query.backups.findFirst({
        where: and(eq(backups.id, input.backupId), eq(backups.serverId, input.serverId)),
      });
      if (!backup || !backup.isSuccessful) throw new ORPCError("NOT_FOUND");

      const client = createWingsClient(server.node as typeof nodes.$inferSelect);
      await client.restoreBackup(server.uuid, backup.uuid);

      recordActivity({
        eventType: "server:backup.restore",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: backup.name },
      });
    }),
};
