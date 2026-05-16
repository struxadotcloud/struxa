import {
  index,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { servers } from "./servers";
import { eggVariables } from "./egg-variables";

export const serverVariables = mysqlTable(
  "server_variables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    variableId: varchar("variable_id", { length: 36 })
      .notNull()
      .references(() => eggVariables.id),
    variableValue: text("variable_value").notNull().default(""),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("server_variables_serverId_idx").on(table.serverId),
    unique("server_variables_server_variable_unique").on(
      table.serverId,
      table.variableId,
    ),
  ],
);
