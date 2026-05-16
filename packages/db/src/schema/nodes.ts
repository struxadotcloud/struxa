import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { locations } from "./locations";

export const nodes = mysqlTable(
  "nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uuid: varchar("uuid", { length: 36 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    locationId: varchar("location_id", { length: 36 })
      .notNull()
      .references(() => locations.id),
    fqdn: varchar("fqdn", { length: 255 }).notNull(),
    scheme: varchar("scheme", { length: 10 }).notNull().default("https"),
    memory: int("memory").notNull(),
    memoryOverallocate: int("memory_overallocate").notNull().default(0),
    disk: int("disk").notNull(),
    diskOverallocate: int("disk_overallocate").notNull().default(0),
    uploadSize: int("upload_size").notNull().default(100),
    daemonListen: int("daemon_listen").notNull().default(8080),
    daemonSFTP: int("daemon_sftp").notNull().default(2022),
    daemonBase: varchar("daemon_base", { length: 255 })
      .notNull()
      .default("/var/lib/pterodactyl"),
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
    tokenId: varchar("token_id", { length: 36 }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("nodes_locationId_idx").on(table.locationId),
    unique("nodes_tokenId_unique").on(table.tokenId),
  ],
);
