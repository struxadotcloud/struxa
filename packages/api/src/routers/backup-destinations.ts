import { randomUUID } from "crypto";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { backupDestinations } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { encrypt } from "../lib/crypto";
import {
  backupDestinationInputSchema,
  getDestinationForNode,
} from "../lib/backup-destinations";
import { adminProcedure } from "../index";

function serializeConfig(input: z.infer<typeof backupDestinationInputSchema>): string {
  const { type: _type, ...config } = input;
  return encrypt(JSON.stringify(config));
}

export const backupDestinationsRouter = {
  getGlobal: adminProcedure.handler(async () => {
    return getDestinationForNode(null);
  }),

  upsertGlobal: adminProcedure
    .input(backupDestinationInputSchema)
    .handler(async ({ context, input }) => {
      await db.delete(backupDestinations).where(isNull(backupDestinations.nodeId));

      await db.insert(backupDestinations).values({
        id: randomUUID(),
        nodeId: null,
        type: input.type,
        config: serializeConfig(input),
      });

      recordActivity({
        eventType: "admin:backup-destination.update",
        userId: context.session.user.id,
        ip: context.ip,
        properties: { type: input.type, scope: "global" },
      });

      return getDestinationForNode(null);
    }),

  clearGlobal: adminProcedure.handler(async ({ context }) => {
    await db.delete(backupDestinations).where(isNull(backupDestinations.nodeId));

    recordActivity({
      eventType: "admin:backup-destination.clear",
      userId: context.session.user.id,
      ip: context.ip,
      properties: { scope: "global" },
    });
  }),

  getForNode: adminProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return getDestinationForNode(input.nodeId);
    }),

  upsertForNode: adminProcedure
    .input(
      z.object({ nodeId: z.string().uuid() }).and(backupDestinationInputSchema),
    )
    .handler(async ({ context, input }) => {
      const { nodeId, ...destination } = input;
      const config = serializeConfig(destination);

      await db
        .insert(backupDestinations)
        .values({
          id: randomUUID(),
          nodeId,
          type: destination.type,
          config,
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            type: destination.type,
            config,
            updatedAt: new Date(),
          },
        });

      recordActivity({
        eventType: "admin:backup-destination.update",
        userId: context.session.user.id,
        nodeId,
        ip: context.ip,
        properties: { type: destination.type, scope: "node" },
      });

      return getDestinationForNode(nodeId);
    }),

  clearForNode: adminProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await db
        .delete(backupDestinations)
        .where(eq(backupDestinations.nodeId, input.nodeId));

      recordActivity({
        eventType: "admin:backup-destination.clear",
        userId: context.session.user.id,
        nodeId: input.nodeId,
        ip: context.ip,
        properties: { scope: "node" },
      });
    }),
};
