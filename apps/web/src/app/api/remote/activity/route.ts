import type { NextRequest } from "next/server";
import { recordActivityBatch } from "@struxa/api/services/wings-activity";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as { data: unknown[] };
  if (!Array.isArray(body?.data)) {
    return new Response("Bad Request", { status: 400 });
  }

  await recordActivityBatch(body.data as Parameters<typeof recordActivityBatch>[0]);
  return new Response(null, { status: 204 });
}
