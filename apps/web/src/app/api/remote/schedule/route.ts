import type { NextRequest } from "next/server";
import { completeSchedule } from "@struxa/api/services/schedules";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as { schedule_id: string };
  if (!body?.schedule_id) return new Response("Bad Request", { status: 400 });

  await completeSchedule(body.schedule_id);
  return new Response(null, { status: 204 });
}
