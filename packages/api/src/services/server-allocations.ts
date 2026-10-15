import { ORPCError } from "@orpc/server";
import { db, nodeAllocations } from "@struxa/db";
import { and, eq, inArray, notInArray } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Lock before checking ownership so concurrent purchases/admin saves cannot steal ports.
export async function assignServerAllocations(
  tx: Transaction,
  serverId: string,
  nodeId: string,
  allocationIds: string[],
) {
  const ids = [...new Set(allocationIds)].sort();
  const rows = await tx.select().from(nodeAllocations)
    .where(inArray(nodeAllocations.id, ids)).orderBy(nodeAllocations.id).for("update");
  if (rows.length !== ids.length || rows.some((row) =>
    row.nodeId !== nodeId || (row.serverId !== null && row.serverId !== serverId),
  )) {
    throw new ORPCError("BAD_REQUEST", { message: "Allocations must be available on the server's node" });
  }
  await tx.update(nodeAllocations).set({ serverId: null }).where(and(
    eq(nodeAllocations.serverId, serverId), notInArray(nodeAllocations.id, ids),
  ));
  await tx.update(nodeAllocations).set({ serverId }).where(inArray(nodeAllocations.id, ids));
}
