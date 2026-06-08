import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@struxa/db";
import { nodes } from "@struxa/db";
import { eq } from "drizzle-orm";
import { safeDecrypt } from "@struxa/api/lib/crypto";

type NodeRecord = typeof nodes.$inferSelect;

export type WingsAuthResult =
  | { ok: true; node: NodeRecord }
  | { ok: false; response: Response };

export async function authenticateWings(
  req: NextRequest,
): Promise<WingsAuthResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  const bearer = authHeader.slice(7);
  const dotIdx = bearer.indexOf(".");
  if (dotIdx === -1) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  const tokenId = bearer.slice(0, dotIdx);
  const token = bearer.slice(dotIdx + 1);

  const node = await db.query.nodes.findFirst({
    where: eq(nodes.tokenId, tokenId),
  });

  if (!node) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  try {
    const a = Buffer.from(safeDecrypt(node.token), "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        ok: false,
        response: new Response("Unauthorized", { status: 401 }),
      };
    }
  } catch {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  return { ok: true, node };
}
