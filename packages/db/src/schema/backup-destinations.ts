import {
  index,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { nodes } from "./nodes";

export const backupDestinations = mysqlTable(
  "backup_destinations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    nodeId: varchar("node_id", { length: 36 }).references(() => nodes.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 36 }).notNull(),
    config: text("config").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("backup_destinations_nodeId_idx").on(table.nodeId),
    unique("backup_destinations_nodeId_unique").on(table.nodeId),
  ],
);
