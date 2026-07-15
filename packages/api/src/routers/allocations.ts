import { randomUUID } from "crypto";
import { and, count, eq, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { nodeAllocations } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { adminProcedure } from "../index";

export const allocationsRouter = {
  listByNode: adminProcedure
    .input(z.object({ nodeId: z.string().uuid(), page: z.number().int().min(1).default(1) }))
    .handler(async ({ input }) => {
      const pageSize = 50;
      const offset = (input.page - 1) * pageSize;
      const where = eq(nodeAllocations.nodeId, input.nodeId);

      const [allocations, totalResult] = await Promise.all([
        db.query.nodeAllocations.findMany({
          where,
          limit: pageSize,
          offset,
          orderBy: (a, { asc }) => [asc(a.port)],
        }),
        db.select({ total: count() }).from(nodeAllocations).where(where),
      ]);

      return { allocations, total: totalResult[0]?.total ?? 0, page: input.page, pageSize };
    }),

  search: adminProcedure
    .input(z.object({ nodeId: z.string().uuid(), query: z.string().max(100).optional(), limit: z.number().int().min(1).max(50).default(20) }))
    .handler(async ({ input }) => {
      const q = input.query?.trim();
      return db.query.nodeAllocations.findMany({
        where: and(
          eq(nodeAllocations.nodeId, input.nodeId),
          isNull(nodeAllocations.serverId),
          q ? or(like(nodeAllocations.ip, `%${q}%`), like(sql`CAST(${nodeAllocations.port} AS CHAR)`, `%${q}%`)) : undefined,
        ),
        limit: input.limit,
        orderBy: (a, { asc }) => [asc(a.port)],
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
    .handler(async ({ context, input }) => {
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
      recordActivity({ eventType: "admin:allocation.create", userId: context.session.user.id, nodeId: input.nodeId, ip: context.ip, properties: { ip: input.ip, ports: input.ports } });
      return { created: rows.length };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
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
      recordActivity({ eventType: "admin:allocation.delete", userId: context.session.user.id, nodeId: allocation.nodeId, ip: context.ip, properties: { ip: allocation.ip, port: allocation.port } });
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
