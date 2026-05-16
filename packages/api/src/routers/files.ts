import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { nodes, servers, subusers } from "@struxa/db";
import { protectedProcedure } from "../index";

export const filesRouter = {
  getToken: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";

      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const node = server.node as typeof nodes.$inferSelect;
      const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}`;

      return { token: node.token, baseUrl };
    }),
};
