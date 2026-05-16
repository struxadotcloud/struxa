import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { nodeAllocations } from "@struxa/db";
import { adminProcedure } from "../index";

export const allocationsRouter = {
  listByNode: adminProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.nodeAllocations.findMany({
        where: eq(nodeAllocations.nodeId, input.nodeId),
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        ip: z.string().min(1).max(45),
        ipAlias: z.string().max(255).optional(),
        ports: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      const ports = expandPortRange(input.ports);
      if (ports.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No valid ports specified" });
      }

      const rows = ports.map((port) => ({
        id: randomUUID(),
        nodeId: input.nodeId,
        ip: input.ip,
        ipAlias: input.ipAlias ?? null,
        port,
      }));

      await db.insert(nodeAllocations).values(rows);
      return { created: rows.length };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const allocation = await db.query.nodeAllocations.findFirst({
        where: eq(nodeAllocations.id, input.id),
      });
      if (!allocation) throw new ORPCError("NOT_FOUND");
      if (allocation.serverId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cannot delete an allocation assigned to a server",
        });
      }
      await db.delete(nodeAllocations).where(eq(nodeAllocations.id, input.id));
    }),
};

function expandPortRange(ports: string): number[] {
  const result: number[] = [];
  for (const part of ports.split(",")) {
    const trimmed = part.trim();
    const rangeParts = trimmed.split("-");
    if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0]!, 10);
      const end = parseInt(rangeParts[1]!, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let p = start; p <= Math.min(end, start + 1000); p++) {
          result.push(p);
        }
      }
    } else {
      const port = parseInt(trimmed, 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        result.push(port);
      }
    }
  }
  return result;
}
