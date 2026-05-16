import type { NextRequest } from "next/server";
import { getServerList } from "@struxa/api/services/wings-servers";
import { authenticateWings } from "@/lib/wings-auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const perPage = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("per_page") ?? "50")),
  );

  const result = await getServerList(auth.node.id, page, perPage);
  return Response.json(result);
}
