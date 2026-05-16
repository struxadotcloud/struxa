import type { NextRequest } from "next/server";
import { authenticateWings } from "@/lib/wings-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  // Transfer completion is handled by the panel's transfer initiation flow.
  // Wings reports success here; the panel marks the transfer complete.
  return new Response(null, { status: 204 });
}
