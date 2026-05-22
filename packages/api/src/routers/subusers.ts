import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { servers, subusers, user } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

export const subusersRouter = {
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

      return db.query.subusers.findMany({
        where: eq(subusers.serverId, input.serverId),
        with: { user: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        email: z.string().email(),
        permissions: z.array(z.string()).default([]),
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

      const targetUser = await db.query.user.findFirst({
        where: eq(user.email, input.email),
      });
      if (!targetUser) {
        throw new ORPCError("NOT_FOUND", { message: "No user found with that email" });
      }
      if (targetUser.id === server.userId) {
        throw new ORPCError("BAD_REQUEST", { message: "Cannot add server owner as subuser" });
      }

      const existing = await db.query.subusers.findFirst({
        where: and(eq(subusers.userId, targetUser.id), eq(subusers.serverId, input.serverId)),
      });
      if (existing) {
        throw new ORPCError("BAD_REQUEST", { message: "User is already a subuser" });
      }

      const id = randomUUID();
      await db.insert(subusers).values({
        id,
        userId: targetUser.id,
        serverId: input.serverId,
        permissions: JSON.stringify(input.permissions),
      });

      recordActivity({
        eventType: "user:subuser-create",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { targetEmail: input.email },
      });

      return db.query.subusers.findFirst({ where: eq(subusers.id, id), with: { user: true } });
    }),

  update: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        userId: z.string().min(1),
        permissions: z.array(z.string()),
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

      await db
        .update(subusers)
        .set({ permissions: JSON.stringify(input.permissions) })
        .where(
          and(eq(subusers.userId, input.userId), eq(subusers.serverId, input.serverId)),
        );

      recordActivity({
        eventType: "user:subuser-update",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { targetUserId: input.userId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), userId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (server.userId !== context.session.user.id && context.session.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN");
      }

      await db
        .delete(subusers)
        .where(
          and(eq(subusers.userId, input.userId), eq(subusers.serverId, input.serverId)),
        );

      recordActivity({
        eventType: "user:subuser-delete",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { targetUserId: input.userId },
      });
    }),
};
