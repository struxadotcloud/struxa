import type { NextRequest } from "next/server";
import { resetNodeServers } from "@struxa/api/services/wings-servers";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  await resetNodeServers(auth.node.id);
  return new Response(null, { status: 204 });
}
