import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";
import { authenticateWings } from "@/lib/wings-auth";

interface RestoreCompleteBody {
  server_uuid: string;
  successful: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;

  const backup = await db.query.backups.findFirst({
    where: eq(backups.uuid, uuid),
  });
  if (!backup) return new Response("Not Found", { status: 404 });

  const body = (await req.json()) as RestoreCompleteBody;

  if (!body.successful) {
    const safeServerUUID = String(body.server_uuid).replace(/[\r\n]/g, "");
    console.error(`Backup restore failed for ${uuid} on server ${safeServerUUID}`);
  }

  return new Response(null, { status: 204 });
}
