import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const databaseEngineTypes = [
  "mysql",
  "mariadb",
  "postgresql",
  "mongodb",
  "redis",
] as const;

export type DatabaseEngineType = (typeof databaseEngineTypes)[number];

export const databaseHosts = mysqlTable("database_hosts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", databaseEngineTypes).notNull().default("mysql"),
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull().default(3306),
  username: varchar("username", { length: 100 }).notNull(),
  password: text("password").notNull(),
  ssl: boolean("ssl").notNull().default(false),
  maxDatabases: int("max_databases").notNull().default(0),
  allowedNodeIds: text("allowed_node_ids"),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
