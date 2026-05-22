import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@struxa/auth";
import { db } from "@struxa/db";
import { nodes, servers, subusers } from "@struxa/db";
import { recordActivity } from "@struxa/api/services/activity";

type Params = { params: Promise<{ id: string; path: string[] }> };

async function proxy(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id, path } = await params;

  const server = await db.query.servers.findFirst({
    where: eq(servers.uuid, id),
    with: { node: true },
  });
  if (!server) return new Response("Not Found", { status: 404 });

  const isOwner = server.userId === session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!isOwner && !isAdmin) {
    const sub = await db.query.subusers.findFirst({
      where: and(eq(subusers.userId, session.user.id), eq(subusers.serverId, server.id)),
    });
    if (!sub) return new Response("Forbidden", { status: 403 });
  }

  const node = server.node as typeof nodes.$inferSelect;
  const daemonUrl = `${node.scheme}://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}/files/${path.join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${node.token}`,
  };
  const ct = req.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;

  const upstream = await fetch(daemonUrl, {
    method: req.method,
    headers,
    ...(req.body ? { body: req.body, duplex: "half" } : {}),
  });

  const resHeaders: Record<string, string> = {};
  const resContentType = upstream.headers.get("Content-Type");
  if (resContentType) resHeaders["Content-Type"] = resContentType;

  if (upstream.ok) {
    const action = path[path.length - 1];
    const filePath = req.nextUrl.searchParams.get("file");
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    if (req.method === "POST" && action === "write") {
      recordActivity({
        eventType: "server:files.write",
        userId: session.user.id,
        serverId: server.id,
        ip,
        properties: filePath ? { file: filePath } : undefined,
      });
    } else if (req.method === "GET" && action === "contents") {
      recordActivity({
        eventType: "server:files.read",
        userId: session.user.id,
        serverId: server.id,
        ip,
        properties: filePath ? { file: filePath } : undefined,
      });
    }
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

export const GET = proxy;
export const POST = proxy;
