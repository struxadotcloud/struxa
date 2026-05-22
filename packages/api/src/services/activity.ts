import { createHash, randomUUID } from "crypto";
import { db } from "@struxa/db";
import { activityLogs } from "@struxa/db";

export function recordActivity(opts: {
  eventType: string;
  userId?: string | null;
  serverId?: string | null;
  nodeId?: string | null;
  properties?: Record<string, unknown>;
  ip?: string | null;
}): void {
  const row = {
    id: randomUUID(),
    batchUuid: null,
    eventType: opts.eventType,
    userId: opts.userId ?? null,
    serverId: opts.serverId ?? null,
    nodeId: opts.nodeId ?? null,
    properties: opts.properties ? JSON.stringify(opts.properties) : null,
    ip: opts.ip ?? null,
    hashedIp: opts.ip ? createHash("sha256").update(opts.ip).digest("hex") : null,
    timestamp: new Date(),
  };

  db.insert(activityLogs).values(row).catch(console.error);
}
