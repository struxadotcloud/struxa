import {
  index,
  mysqlTable,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { servers } from "./servers";
import { mounts } from "./mounts";

export const serverMounts = mysqlTable(
  "server_mounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    mountId: varchar("mount_id", { length: 36 })
      .notNull()
      .references(() => mounts.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("server_mounts_serverId_idx").on(table.serverId),
    unique("server_mounts_unique").on(table.serverId, table.mountId),
  ],
);
