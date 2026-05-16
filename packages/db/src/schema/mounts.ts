import {
  boolean,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const mounts = mysqlTable("mounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  uuid: varchar("uuid", { length: 36 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  source: varchar("source", { length: 255 }).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  readOnly: boolean("read_only").notNull().default(false),
  userMountable: boolean("user_mountable").notNull().default(false),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
