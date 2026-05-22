import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { activityLogs, servers, subusers } from "@struxa/db";
import { protectedProcedure } from "../index";

export const activityRouter = {
  list: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(50).default(25),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, input.serverId)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const offset = (input.page - 1) * input.perPage;
      const rows = await db.query.activityLogs.findMany({
        where: eq(activityLogs.serverId, input.serverId),
        orderBy: [desc(activityLogs.timestamp)],
        limit: input.perPage,
        offset,
        with: {
          user: {
            columns: { name: true, email: true, image: true },
          },
        },
      });

      return { data: rows, meta: { page: input.page, perPage: input.perPage } };
    }),
};
