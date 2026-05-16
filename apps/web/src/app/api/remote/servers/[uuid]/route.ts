import type { NextRequest } from "next/server";
import { getServerConfig } from "@struxa/api/services/wings-servers";
import { authenticateWings } from "@/lib/wings-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;
  const config = await getServerConfig(uuid, auth.node.id);
  if (!config) return new Response("Not Found", { status: 404 });

  return Response.json(config);
}
