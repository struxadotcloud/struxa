import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const databaseHosts = mysqlTable("database_hosts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull().default(3306),
  username: varchar("username", { length: 100 }).notNull(),
  password: text("password").notNull(),
  maxDatabases: int("max_databases").notNull().default(0),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
