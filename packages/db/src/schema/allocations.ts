import {
  index,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { nodes } from "./nodes";

export const nodeAllocations = mysqlTable(
  "node_allocations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    nodeId: varchar("node_id", { length: 36 })
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    ip: varchar("ip", { length: 45 }).notNull(),
    ipAlias: varchar("ip_alias", { length: 255 }),
    port: int("port").notNull(),
    serverId: varchar("server_id", { length: 36 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("allocations_nodeId_idx").on(table.nodeId),
    index("allocations_serverId_idx").on(table.serverId),
  ],
);
