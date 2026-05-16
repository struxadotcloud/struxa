import {
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { nests } from "./nests";

export const eggs = mysqlTable(
  "eggs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uuid: varchar("uuid", { length: 36 }).notNull().unique(),
    nestId: varchar("nest_id", { length: 36 })
      .notNull()
      .references(() => nests.id),
    configFrom: varchar("config_from", { length: 36 }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    features: text("features"),
    dockerImages: text("docker_images").notNull(),
    stopCommand: varchar("stop_command", { length: 255 }),
    startup: text("startup").notNull(),
    configFiles: text("config_files"),
    configStartup: text("config_startup"),
    configStop: text("config_stop"),
    configLogs: text("config_logs"),
    scriptInstall: text("script_install"),
    scriptEntry: varchar("script_entry", { length: 255 }).default("bash"),
    scriptContainer: varchar("script_container", { length: 255 }),
    scriptExtension: varchar("script_extension", { length: 255 }).default("sh"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("eggs_nestId_idx").on(table.nestId)],
);
