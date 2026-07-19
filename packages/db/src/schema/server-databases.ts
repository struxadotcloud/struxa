import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { servers } from "./servers";
import { databaseHosts } from "./database-hosts";

export const serverDatabases = mysqlTable(
  "server_databases",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uuid: varchar("uuid", { length: 36 }).notNull().unique(),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    hostId: varchar("host_id", { length: 36 })
      .notNull()
      .references(() => databaseHosts.id),
    database: varchar("database", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    maxConnections: int("max_connections").notNull().default(0),
    remote: varchar("remote", { length: 15 }),
    password: text("password").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("server_databases_serverId_idx").on(table.serverId)],
);
