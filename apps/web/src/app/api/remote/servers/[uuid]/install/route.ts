import type { NextRequest } from "next/server";
import {
  completeInstall,
  getInstallScript,
} from "@struxa/api/services/wings-servers";
import { authenticateWings } from "@/lib/wings-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;
  const script = await getInstallScript(uuid, auth.node.id);
  if (!script) return new Response("Not Found", { status: 404 });

  return Response.json(script);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;
  const body = (await req.json()) as { successful: boolean; reinstall?: boolean };

  const found = await completeInstall(uuid, auth.node.id, body.successful);
  if (!found) return new Response("Not Found", { status: 404 });

  return new Response(null, { status: 204 });
}
