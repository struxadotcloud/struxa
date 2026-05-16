import {
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    batchUuid: varchar("batch_uuid", { length: 36 }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    userId: varchar("user_id", { length: 36 }),
    serverId: varchar("server_id", { length: 36 }),
    nodeId: varchar("node_id", { length: 36 }),
    properties: text("properties"),
    ip: varchar("ip", { length: 100 }),
    hashedIp: varchar("hashed_ip", { length: 255 }),
    timestamp: timestamp("timestamp", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_serverId_idx").on(table.serverId),
    index("activity_logs_userId_idx").on(table.userId),
    index("activity_logs_timestamp_idx").on(table.timestamp),
  ],
);
