import { createHash, randomUUID } from "crypto";
import { db } from "@struxa/db";
import { activityLogs } from "@struxa/db";

interface ActivityEvent {
  event: string;
  batch?: string;
  server?: string;
  user?: string | null;
  ip?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivityBatch(events: ActivityEvent[]): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map((e) => ({
    id: randomUUID(),
    batchUuid: e.batch ?? null,
    eventType: e.event,
    userId: e.user ?? null,
    serverId: e.server ?? null,
    nodeId: null,
    properties: e.metadata ? JSON.stringify(e.metadata) : null,
    ip: e.ip ?? null,
    hashedIp: e.ip ? createHash("sha256").update(e.ip).digest("hex") : null,
    timestamp: new Date(e.timestamp),
  }));

  await db.insert(activityLogs).values(rows);
}
