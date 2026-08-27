import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { db } from "@struxa/db";
import { nodes, servers, subusers } from "@struxa/db";
import { safeDecrypt } from "@struxa/api/lib/crypto";
import { recordActivity } from "@struxa/api/services/activity";

type Params = { params: Promise<{ id: string; path: string[] }> };

async function proxy(req: NextRequest, { params }: Params) {
  const auth = await getAuth();
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
  const action = path[path.length - 1];
  const daemonUrl = `${node.scheme}://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}/files/${path.join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${safeDecrypt(node.token)}`,
  };
  const ct = req.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;

  let bodyJson: { files?: unknown[] } | null = null;
  if ((req.method === "POST" && action === "delete") || (req.method === "PUT" && action === "rename")) {
    bodyJson = (await req.clone().json().catch(() => null)) as { files?: unknown[] } | null;
  }

  const upstream = await fetch(daemonUrl, {
    method: req.method,
    headers,
    ...(req.body ? { body: req.body, duplex: "half" } : {}),
  });

  const resHeaders: Record<string, string> = {};
  const resContentType = upstream.headers.get("Content-Type");
  if (resContentType) resHeaders["Content-Type"] = resContentType;

  if (upstream.ok) {
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
    } else if (req.method === "POST" && action === "delete" && bodyJson) {
      const files = (bodyJson.files ?? []).filter((f): f is string => typeof f === "string");
      if (files.length > 0) {
        recordActivity({
          eventType: "server:files.delete",
          userId: session.user.id,
          serverId: server.id,
          ip,
          properties: { file: files.join(", ") },
        });
      }
    } else if (req.method === "PUT" && action === "rename" && bodyJson) {
      const renames = (bodyJson.files ?? []).filter(
        (f): f is { from: string; to: string } =>
          typeof f === "object" && f !== null &&
          typeof (f as { from?: unknown }).from === "string" &&
          typeof (f as { to?: unknown }).to === "string",
      ) as { from: string; to: string }[];
      if (renames.length > 0) {
        recordActivity({
          eventType: "server:files.rename",
          userId: session.user.id,
          serverId: server.id,
          ip,
          properties: { file: renames.map((f) => `${f.from} → ${f.to}`).join(", ") },
        });
      }
    }
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
