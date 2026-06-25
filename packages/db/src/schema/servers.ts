import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { nodes } from "./nodes";
import { eggs } from "./eggs";
import { nodeAllocations } from "./allocations";

export const servers = mysqlTable(
  "servers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uuid: varchar("uuid", { length: 36 }).notNull().unique(),
    uuidShort: varchar("uuid_short", { length: 8 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    nodeId: varchar("node_id", { length: 36 })
      .notNull()
      .references(() => nodes.id),
    eggId: varchar("egg_id", { length: 36 })
      .notNull()
      .references(() => eggs.id),
    allocationId: varchar("allocation_id", { length: 36 })
      .notNull()
      .references(() => nodeAllocations.id),
    status: varchar("status", { length: 30 }).notNull().default(""),
    powerState: varchar("power_state", { length: 20 }).default("offline"),
    suspended: boolean("suspended").notNull().default(false),
    memory: int("memory").notNull(),
    disk: int("disk").notNull(),
    cpu: int("cpu").notNull(),
    swap: int("swap").notNull().default(0),
    io: int("io").notNull().default(500),
    threads: varchar("threads", { length: 100 }),
    oomDisabled: boolean("oom_disabled").notNull().default(false),
    image: varchar("image", { length: 255 }).notNull(),
    startup: text("startup").notNull(),
    skipScripts: boolean("skip_scripts").notNull().default(false),
    invocation: text("invocation").notNull(),
    subscriptionId: varchar("subscription_id", { length: 36 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("servers_userId_idx").on(table.userId),
    index("servers_nodeId_idx").on(table.nodeId),
    index("servers_eggId_idx").on(table.eggId),
    index("servers_subscriptionId_idx").on(table.subscriptionId),
  ],
);
