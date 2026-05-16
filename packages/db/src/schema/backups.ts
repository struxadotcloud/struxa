import {
  bigint,
  boolean,
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { servers } from "./servers";

export const backups = mysqlTable(
  "backups",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uuid: varchar("uuid", { length: 36 }).notNull().unique(),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    ignoredFiles: text("ignored_files"),
    disk: varchar("disk", { length: 36 }).notNull().default("local"),
    checksum: varchar("checksum", { length: 255 }),
    bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
    completedAt: timestamp("completed_at", { fsp: 3 }),
    isLocked: boolean("is_locked").notNull().default(false),
    isSuccessful: boolean("is_successful").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("backups_serverId_idx").on(table.serverId)],
);
