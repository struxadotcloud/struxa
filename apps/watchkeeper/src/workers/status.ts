import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { nodes, servers } from "@struxa/db";
import { createWingsClient } from "@struxa/api/lib/wings-client";

const INTERVAL_MS = 30_000;

export async function runStatusWorker() {
  console.log("[status] worker started, polling every 30s");
  await tick();
  setInterval(() => void tick(), INTERVAL_MS);
}

async function tick() {
  try {
    const allNodes = await db.query.nodes.findMany();

    await Promise.allSettled(
      allNodes.map(async (node) => {
        const client = createWingsClient(node);

        let utilization: Record<string, { state: string }>;
        try {
          utilization = await client.getUtilization();
        } catch {
          console.warn(`[status] could not reach node ${node.name} (${node.fqdn})`);
          return;
        }

        const nodeServers = await db.query.servers.findMany({
          where: eq(servers.nodeId, node.id),
          columns: { id: true, uuid: true, status: true, powerState: true },
        });

        await Promise.all(
          nodeServers.map(async (server) => {
            if (server.status !== "") return; // skip non-installed (installing, suspended, etc.)

            const state = utilization[server.uuid]?.state ?? "offline";
            if (state === (server.powerState ?? "offline")) return; // no change, skip write

            await db
              .update(servers)
              .set({ powerState: state })
              .where(eq(servers.id, server.id));
          }),
        );
      }),
    );
  } catch (err) {
    console.error("[status] tick error:", err);
  }
}
