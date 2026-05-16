import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@struxa/auth";
import { db } from "@struxa/db";
import { nodeAllocations, nodes, servers, subusers } from "@struxa/db";
import { signWsToken } from "@struxa/api/lib/jwt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const server = await db.query.servers.findFirst({
    where: eq(servers.uuid, id),
    with: { node: true, allocation: true },
  });
  if (!server) return new Response("Not Found", { status: 404 });

  const isOwner = server.userId === session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!isOwner && !isAdmin) {
    const subuserRecord = await db.query.subusers.findFirst({
      where: and(
        eq(subusers.userId, session.user.id),
        eq(subusers.serverId, server.id),
      ),
    });
    if (!subuserRecord) return new Response("Forbidden", { status: 403 });
  }

  const permissions = isAdmin || isOwner
    ? ["*"]
    : await getSubuserPermissions(session.user.id, server.id);

  const token = await signWsToken({
    user_uuid: session.user.id,
    server_uuid: server.uuid,
    permissions,
  });

  const node = server.node as typeof nodes.$inferSelect;
  const socketUrl = `wss://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}/ws`;

  return Response.json({ data: { token, socket: socketUrl } });
}

async function getSubuserPermissions(
  userId: string,
  serverId: string,
): Promise<string[]> {
  const record = await db.query.subusers.findFirst({
    where: and(
      eq(subusers.userId, userId),
      eq(subusers.serverId, serverId),
    ),
  });
  if (!record) return [];
  try {
    return JSON.parse(record.permissions) as string[];
  } catch {
    return [];
  }
}
