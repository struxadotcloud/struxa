import {
  index,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { servers } from "./servers";

export const subusers = mysqlTable(
  "subusers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    permissions: text("permissions").notNull().default("[]"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("subusers_userId_idx").on(table.userId),
    index("subusers_serverId_idx").on(table.serverId),
    unique("subusers_user_server_unique").on(table.userId, table.serverId),
  ],
);
