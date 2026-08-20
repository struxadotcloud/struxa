import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { backups, nodes } from "@struxa/db";
import { createWingsClient } from "../lib/wings-client";
import { safeDecrypt } from "../lib/crypto";
import { signBackupDownloadToken } from "../lib/jwt";
import { requireServerAccess } from "../lib/server-access";
import { adapterStringForType, resolveDestinationForNode } from "../lib/backup-destinations";
import { deleteBackupObject, presignDownloadUrl } from "../services/backup-s3";
import {
  ensureGDriveFolders,
  getAppUrl,
  getGDriveConnection,
  getOperatorGDriveConfig,
} from "../services/google-drive";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

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
        destination: z.enum(["node", "gdrive"]).optional(),
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
      const node = server.node as typeof nodes.$inferSelect;

      let adapter: string;
      let driveUserId: string | null = null;
      if (input.destination === "gdrive") {
        const config = await getOperatorGDriveConfig();
        if (!config) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Google Drive is not configured by the administrator",
          });
        }
        const connection = await getGDriveConnection(context.session.user.id);
        if (!connection) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Connect your Google Drive in account settings",
          });
        }
        await ensureGDriveFolders(connection, server.name, server.uuid);
        adapter = "google-drive";
        driveUserId = context.session.user.id;
      } else {
        const destination = await resolveDestinationForNode(node.id);
        adapter = destination ? adapterStringForType(destination.type) : "wings";
      }

      await db.insert(backups).values({
        id,
        uuid,
        serverId: input.serverId,
        name: input.name,
        ignoredFiles: input.ignoredFiles ?? null,
        disk: adapter,
        driveUserId,
      });

      const client = createWingsClient(node);
      await client.createBackup(server.uuid, {
        uuid,
        ignore: input.ignoredFiles ?? "",
        adapter,
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

      const node = server.node as typeof nodes.$inferSelect;
      const client = createWingsClient(node);
      await client.deleteBackup(server.uuid, backup.uuid);

      if (backup.disk === "s3") {
        const destination = await resolveDestinationForNode(node.id);
        if (destination?.type === "s3") {
          await deleteBackupObject(destination, backup.uuid);
        }
      }

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

      if (backup.disk === "s3") {
        const destination = await resolveDestinationForNode(node.id);
        if (!destination || destination.type !== "s3") {
          throw new ORPCError("BAD_REQUEST", {
            message: "The S3 backup destination for this node is no longer configured",
          });
        }
        if (!destination.allowPublicDownload) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Backup downloads are disabled for this storage destination",
          });
        }
        return { url: await presignDownloadUrl(destination, backup.uuid) };
      }

      if (backup.disk === "google-drive") {
        const connection = backup.driveUserId
          ? await getGDriveConnection(backup.driveUserId)
          : null;
        if (!connection) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Google Drive connection removed",
          });
        }
        return { url: `${await getAppUrl()}/api/backups/${backup.id}/download` };
      }

      const token = await signBackupDownloadToken(
        context.session.user.id,
        server.uuid,
        backup.uuid,
        safeDecrypt(node.token),
      );
      const url = `${node.scheme}://${node.fqdn}:${node.daemonListen}/download/backup?token=${token}`;
      return { url };
    }),

  getDownloadAvailability: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await requireServerAccess(
        context.session.user.id,
        input.serverId,
        context.session.user.role,
      );
      const node = server.node as typeof nodes.$inferSelect;
      const [destination, gdriveConfig, gdriveConnection] = await Promise.all([
        resolveDestinationForNode(node.id),
        getOperatorGDriveConfig(),
        getGDriveConnection(context.session.user.id),
      ]);
      const s3PublicDownloads =
        destination?.type === "s3" && destination.allowPublicDownload;
      return {
        s3PublicDownloads,
        googleDriveConfigured: !!gdriveConfig,
        googleDriveConnected: !!gdriveConnection,
      };
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

      const node = server.node as typeof nodes.$inferSelect;
      const adapter =
        backup.disk && backup.disk !== "local" ? backup.disk : "wings";

      let downloadUrl: string | undefined;
      if (adapter === "s3") {
        const destination = await resolveDestinationForNode(node.id);
        if (!destination || destination.type !== "s3") {
          throw new ORPCError("BAD_REQUEST", {
            message: "The S3 backup destination for this node is no longer configured",
          });
        }
        downloadUrl = await presignDownloadUrl(destination, backup.uuid);
      }

      const client = createWingsClient(node);
      await client.restoreBackup(server.uuid, backup.uuid, {
        adapter,
        download_url: downloadUrl,
      });

      recordActivity({
        eventType: "server:backup.restore",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: backup.name },
      });
    }),
};
