import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { servers, subusers } from "@struxa/db";

export async function requireServerAccess(
  userId: string,
  serverId: string,
  role: string | null | undefined,
) {
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
