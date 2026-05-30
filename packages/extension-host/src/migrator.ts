import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { db, extMigrations } from "@struxa/db";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Applies an extension's owned-table migrations at web boot. Mirrors the core
 * Go migrator (`packages/db/migrate/main.go`): statements are split on Drizzle's
 * `--> statement-breakpoint`, and applied files are tracked by SHA-256 in the
 * `ext_migrations` table so re-runs are idempotent.
 *
 * Enforces the `db:own` fence: every statement must target a table prefixed
 * `ext_<id>_`. Anything else aborts the extension's migration (and load).
 */

const TABLE_PREFIX = (extId: string) => `ext_${extId.replace(/-/g, "_")}_`;

// Strict allowlist of (verb, table-extraction strategy) pairs.
// Each entry: [regex matching the start of the statement, fn that extracts all table names].
// Anything not in this list is rejected outright.
type VerbRule = {
  pattern: RegExp;
  // Returns all table names referenced by this statement type.
  extractTables: (trimmed: string) => string[];
};

const IDENT = "`?([a-zA-Z0-9_]+)`?";

const SQL_KEYWORDS = new Set([
  "create","table","if","not","exists","alter","drop","truncate","insert",
  "into","update","delete","from","index","unique","on","add","column",
  "constraint","primary","key","foreign","references","default","null","auto_increment",
  "varchar","int","integer","bigint","tinyint","smallint","text","blob","datetime",
  "timestamp","boolean","bool","float","double","decimal","unsigned","signed",
  "character","set","collate","engine","innodb","charset","utf8","utf8mb4",
  "cascade","restrict","no","action","set","where","values","select","join",
  "inner","outer","left","right","full","cross","using","as","asc","desc",
  "order","by","group","having","limit","offset","distinct","all","and","or",
  "in","like","between","is","case","when","then","else","end","now","current_timestamp",
]);

const VERB_RULES: VerbRule[] = [
  {
    // CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON table (cols)
    pattern: /^\s*create\s+(?:unique\s+)?index\s+/i,
    extractTables(s) {
      const m = new RegExp(`\\bon\\s+${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
  {
    // DROP INDEX name ON table
    pattern: /^\s*drop\s+index\s+/i,
    extractTables(s) {
      const m = new RegExp(`\\bon\\s+${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
  {
    // CREATE TABLE [IF NOT EXISTS] table
    pattern: /^\s*create\s+table\s+/i,
    extractTables(s) {
      const m = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${IDENT}`, "i").exec(s);
      // Also check REFERENCES targets (foreign keys to non-owned tables are disallowed).
      const refs = [...s.matchAll(new RegExp(`references\\s+${IDENT}`, "gi"))].map(
        (r) => r[1]!.toLowerCase(),
      );
      return m ? [m[1]!.toLowerCase(), ...refs] : refs;
    },
  },
  {
    // ALTER TABLE table
    pattern: /^\s*alter\s+table\s+/i,
    extractTables(s) {
      const m = new RegExp(`alter\\s+table\\s+${IDENT}`, "i").exec(s);
      // Also capture any REFERENCES target in the statement.
      const refs = [...s.matchAll(new RegExp(`references\\s+${IDENT}`, "gi"))].map(
        (r) => r[1]!.toLowerCase(),
      );
      return m ? [m[1]!.toLowerCase(), ...refs] : refs;
    },
  },
  {
    // DROP TABLE [IF EXISTS] table [, table ...]
    pattern: /^\s*drop\s+table\s+/i,
    extractTables(s) {
      const after = s.replace(/^\s*drop\s+table\s+(?:if\s+exists\s+)?/i, "");
      return after
        .split(",")
        .map((t) => t.trim().replace(/^`|`$/g, "").toLowerCase())
        .filter(Boolean);
    },
  },
  {
    // TRUNCATE [TABLE] table
    pattern: /^\s*truncate\s+/i,
    extractTables(s) {
      const m = new RegExp(`truncate\\s+(?:table\\s+)?${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
  {
    // INSERT INTO table
    pattern: /^\s*insert\s+(?:ignore\s+)?into\s+/i,
    extractTables(s) {
      const m = new RegExp(`into\\s+${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
  {
    // UPDATE table
    pattern: /^\s*update\s+/i,
    extractTables(s) {
      const m = new RegExp(`update\\s+${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
  {
    // DELETE FROM table
    pattern: /^\s*delete\s+from\s+/i,
    extractTables(s) {
      const m = new RegExp(`delete\\s+from\\s+${IDENT}`, "i").exec(s);
      return m ? [m[1]!.toLowerCase()] : [];
    },
  },
];

// Patterns that can silently reference tables outside the owned prefix even
// inside an otherwise-allowed verb — block them unconditionally.
const CROSS_TABLE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bselect\b/i, label: "SELECT (subquery / CREATE AS SELECT / INSERT…SELECT)" },
  { re: /\blike\s+`?[a-zA-Z0-9_]/i, label: "CREATE TABLE … LIKE" },
  { re: /\brename\s+(?:to|as)\b/i, label: "RENAME TO/AS" },
  // Multi-table UPDATE: UPDATE t1, t2 SET … or UPDATE t1 JOIN t2 …
  { re: /^\s*update\b[^;]*\b(?:join|,)\b/i, label: "multi-table UPDATE" },
  // Multi-table DELETE: DELETE t FROM t JOIN … or DELETE FROM t USING …
  { re: /^\s*delete\b[^;]*\b(?:join|using)\b/i, label: "multi-table DELETE" },
  { re: /^\s*delete\s+`?[a-zA-Z0-9_]+`?\s+from\b/i, label: "aliased multi-table DELETE" },
];

function assertScoped(extId: string, statement: string): void {
  const prefix = TABLE_PREFIX(extId);
  const trimmed = statement.trim();
  if (!trimmed) return;

  // Block cross-table constructs that can leak data regardless of the primary verb.
  for (const { re, label } of CROSS_TABLE_PATTERNS) {
    if (re.test(trimmed)) {
      throw new Error(
        `migration for "${extId}" uses disallowed construct: ${label}`,
      );
    }
  }

  const rule = VERB_RULES.find((r) => r.pattern.test(trimmed));
  if (!rule) {
    const verb = trimmed.split(/\s+/)[0] ?? "(empty)";
    throw new Error(
      `migration for "${extId}" uses disallowed SQL verb "${verb.toUpperCase()}"`,
    );
  }

  const tables = rule.extractTables(trimmed);
  if (tables.length === 0) {
    throw new Error(
      `migration for "${extId}" has a statement where no target table could be identified`,
    );
  }
  for (const table of tables) {
    if (!table.startsWith(prefix)) {
      throw new Error(
        `migration for "${extId}" targets non-owned table "${table}" (must start with "${prefix}")`,
      );
    }
  }

}

async function listSqlFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return []; // no migrations dir => nothing to do
  }
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

/** Run all pending migrations for an extension. Throws on guard violation. */
export async function runExtensionMigrations(opts: {
  extId: string;
  dir: string;
}): Promise<void> {
  const migrationsDir = path.join(opts.dir, "migrations");
  const files = await listSqlFiles(migrationsDir);
  if (!files.length) return;

  const applied = await db
    .select({ hash: extMigrations.hash })
    .from(extMigrations)
    .where(eq(extMigrations.extId, opts.extId));
  const appliedHashes = new Set(applied.map((r) => r.hash));

  for (const file of files) {
    const raw = await readFile(path.join(migrationsDir, file), "utf8");
    const hash = createHash("sha256").update(raw).digest("hex");
    if (appliedHashes.has(hash)) continue;

    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      assertScoped(opts.extId, statement);
    }
    // Apply only after every statement in the file passed the fence.
    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
      } catch (err: unknown) {
        // Ignore "table already exists" — idempotent on re-install.
        // Drizzle wraps the MySQL error, so errno may be on err or err.cause.
        const mysqlErrno =
          (err as Record<string, unknown>)?.errno ??
          ((err as Record<string, unknown>)?.cause as Record<string, unknown>)?.errno;
        if (mysqlErrno === 1050) continue;
        throw err;
      }
    }

    await db.insert(extMigrations).values({
      id: randomUUID(),
      extId: opts.extId,
      hash,
    });
  }
}

/** Best-effort: drop the migration ledger for an extension on uninstall. */
export async function forgetExtensionMigrations(extId: string): Promise<void> {
  await db.delete(extMigrations).where(and(eq(extMigrations.extId, extId)));
}

function assertValidExtId(extId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(extId)) {
    throw new Error(`invalid extension id "${extId}"`);
  }
}

/**
 * Drop all tables owned by an extension (prefix `ext_<id>_`).
 * Called only when the admin explicitly opts in during uninstall.
 */
export async function dropExtensionTables(extId: string): Promise<void> {
  assertValidExtId(extId);
  const prefix = TABLE_PREFIX(extId);
  const rows = await db.execute<Record<string, unknown>>(
    sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ${prefix + "%"}`,
  );
  // mysql2 returns a [rows, fields] tuple; Drizzle may unwrap it or not.
  const unwrapped: unknown = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
  const rawRows: Record<string, unknown>[] = Array.isArray(unwrapped)
    ? (unwrapped as Record<string, unknown>[])
    : ((unwrapped as { rows: Record<string, unknown>[] }).rows ?? []);
  const names = rawRows
    .map((r) => (r["TABLE_NAME"] ?? r["table_name"]) as string | undefined)
    .filter((n): n is string => typeof n === "string" && n.toLowerCase().startsWith(prefix));
  for (const name of names) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS \`${name}\``));
  }
}
