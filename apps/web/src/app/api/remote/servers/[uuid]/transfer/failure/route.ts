import type { NextRequest } from "next/server";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  return new Response(null, { status: 204 });
}
