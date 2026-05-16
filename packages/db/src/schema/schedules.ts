import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { servers } from "./servers";

export const schedules = mysqlTable(
  "schedules",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    serverId: varchar("server_id", { length: 36 })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    cronSecond: varchar("cron_second", { length: 30 }).notNull().default("0"),
    cronMinute: varchar("cron_minute", { length: 30 }).notNull(),
    cronHour: varchar("cron_hour", { length: 30 }).notNull(),
    cronDayOfWeek: varchar("cron_day_of_week", { length: 30 }).notNull(),
    cronDayOfMonth: varchar("cron_day_of_month", { length: 30 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isProcessing: boolean("is_processing").notNull().default(false),
    timezoneOffset: varchar("timezone_offset", { length: 100 }),
    lastRunAt: timestamp("last_run_at", { fsp: 3 }),
    nextRunAt: timestamp("next_run_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("schedules_serverId_idx").on(table.serverId)],
);

export const scheduleTasks = mysqlTable(
  "schedule_tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scheduleId: varchar("schedule_id", { length: 36 })
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    sequenceId: int("sequence_id").notNull(),
    action: varchar("action", { length: 60 }).notNull(),
    payload: text("payload").notNull(),
    timeOffset: int("time_offset").notNull().default(0),
    isQueued: boolean("is_queued").notNull().default(false),
    continueOnFailure: boolean("continue_on_failure").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("schedule_tasks_scheduleId_idx").on(table.scheduleId)],
);
