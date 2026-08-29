import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { db } from "@struxa/db";
import { nodes, servers, subusers } from "@struxa/db";
import { safeDecrypt } from "@struxa/api/lib/crypto";
import { signFileDownloadToken } from "@struxa/api/lib/jwt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = req.nextUrl.searchParams.get("file");
  if (!file) return new Response("Missing file parameter", { status: 400 });

  const normalized = file.replace(/\\/g, "/");
  if (normalized.includes("\0") || normalized.split("/").some((segment) => segment === "..")) {
    return new Response("Invalid file parameter", { status: 400 });
  }

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
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(sub.permissions) as string[];
    } catch {
      permissions = [];
    }
    const hasFileAccess = permissions.some(
      (p) => p === "*" || p === "files" || p === "file" || p.startsWith("file."),
    );
    if (!hasFileAccess) return new Response("Forbidden", { status: 403 });
  }

  const node = server.node as typeof nodes.$inferSelect;
  const token = await signFileDownloadToken(
    session.user.id,
    server.uuid,
    file,
    safeDecrypt(node.token),
  );
  const url = `${node.scheme}://${node.fqdn}:${node.daemonListen}/download/file?token=${encodeURIComponent(token)}`;
  return Response.redirect(url, { status: 302, headers: { "Referrer-Policy": "no-referrer" } });
}
