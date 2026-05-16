import type { NextRequest } from "next/server";
import { authenticateSftp } from "@struxa/api/services/wings-sftp";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const body = await req.json() as { username?: string; password?: string };
  const username = body.username ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return new Response("Bad Request", { status: 400 });
  }

  const result = await authenticateSftp(username, password);
  if (!result) return new Response("Unauthorized", { status: 403 });

  return Response.json(result);
}
