import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@struxa/db";
import {
  eggVariables,
  serverVariables,
  servers,
} from "@struxa/db";
import { buildInvocation } from "@struxa/api/services/wings-servers";
import { authenticateWings } from "@/lib/wings-auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;
  const body = (await req.json()) as {
    env_variable: string;
    value: string;
    schedule_uuid?: string;
  };

  const server = await db.query.servers.findFirst({
    where: and(eq(servers.uuid, uuid), eq(servers.nodeId, auth.node.id)),
  });
  if (!server) return new Response("Not Found", { status: 404 });

  const eggVar = await db.query.eggVariables.findFirst({
    where: and(
      eq(eggVariables.eggId, server.eggId),
      eq(eggVariables.envVariable, body.env_variable),
    ),
  });
  if (!eggVar) return new Response("Variable Not Found", { status: 404 });

  await db
    .update(serverVariables)
    .set({ variableValue: body.value })
    .where(
      and(
        eq(serverVariables.serverId, server.id),
        eq(serverVariables.variableId, eggVar.id),
      ),
    );

  const allVars = await db.query.serverVariables.findMany({
    where: eq(serverVariables.serverId, server.id),
    with: { variable: true },
  });

  const varMap: Record<string, string> = {};
  for (const sv of allVars) {
    varMap[sv.variable.envVariable] = sv.variableValue;
  }
  const newInvocation = buildInvocation(server.startup, varMap);

  await db
    .update(servers)
    .set({ invocation: newInvocation })
    .where(eq(servers.id, server.id));

  return new Response(null, { status: 204 });
}
