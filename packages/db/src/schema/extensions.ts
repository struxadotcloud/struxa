import {
  boolean,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Installed extensions. The source of truth for what the boot loader should
 * load. The on-disk package under EXTENSIONS_DIR is the file source; this row
 * tracks install state, the admin-approved capability grants, and lifecycle.
 */
export const extensions = mysqlTable("extensions", {
  // Extension slug, e.g. "foo". Namespaces tables (ext_foo_*), routes (/x/foo,
  // ext.foo.* api), and settings keys (foo.*).
  id: varchar("id", { length: 64 }).primaryKey(),
  version: varchar("version", { length: 32 }).notNull(),
  // Where the package was downloaded from (registry URL).
  sourceUrl: varchar("source_url", { length: 1024 }),
  // Full validated manifest captured at install time.
  manifest: json("manifest").$type<Record<string, unknown>>().notNull(),
  // Permissions the admin approved. The capability broker only grants these.
  grantedPermissions: json("granted_permissions")
    .$type<string[]>()
    .notNull()
    .default([]),
  // Whether the loader should activate it on boot.
  enabled: boolean("enabled").notNull().default(false),
  // installed | errored | disabled
  status: varchar("status", { length: 20 }).notNull().default("installed"),
  // Last load error, if status === "errored".
  lastError: varchar("last_error", { length: 2048 }),
  installedAt: timestamp("installed_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Tracks which owned-table migrations have been applied per extension, so the
 * runtime migrator (run at web boot) is idempotent. Mirrors the core
 * __drizzle_migrations approach but scoped by extension id.
 */
export const extMigrations = mysqlTable(
  "ext_migrations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    extId: varchar("ext_id", { length: 64 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    appliedAt: timestamp("applied_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("ext_migrations_extId_hash_idx").on(table.extId, table.hash)],
);
