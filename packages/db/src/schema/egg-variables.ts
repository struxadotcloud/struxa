import {
  boolean,
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { eggs } from "./eggs";

export const eggVariables = mysqlTable(
  "egg_variables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eggId: varchar("egg_id", { length: 36 })
      .notNull()
      .references(() => eggs.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    envVariable: varchar("env_variable", { length: 255 }).notNull(),
    defaultValue: text("default_value"),
    userViewable: boolean("user_viewable").notNull().default(true),
    userEditable: boolean("user_editable").notNull().default(true),
    rules: text("rules"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("egg_variables_eggId_idx").on(table.eggId)],
);
