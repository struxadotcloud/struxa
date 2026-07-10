import { drizzle } from "drizzle-orm/mysql2";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = drizzle({ connection: { uri: DATABASE_URL } });

// MySQL DDL auto-commits statement-by-statement (no transactional DDL like
// Postgres), so a migration killed mid-file leaves some of its statements
// already applied. Re-running that file from the top then fails with
// "duplicate column" / "table already exists" errors even though the
// migration never got marked as applied. Treat those specific errors as
// "already applied" and keep going instead of crashing the whole migrate run.
const ALREADY_APPLIED_ERRNOS = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME
  1061, // ER_DUP_KEYNAME
  1826, // ER_FK_DUP_NAME
]);

const MIGRATIONS_TABLE = "__drizzle_migrations";

console.log("[migrate] running migrations...");

await db.execute(sql`
  create table if not exists ${sql.identifier(MIGRATIONS_TABLE)} (
    id serial primary key,
    hash text not null,
    created_at bigint
  )
`);

const [lastRow] = await db.execute(
  sql`select created_at from ${sql.identifier(MIGRATIONS_TABLE)} order by created_at desc limit 1`,
);
const lastAppliedAt = Number((lastRow as { created_at?: number } | undefined)?.created_at ?? 0);

const migrations = readMigrationFiles({ migrationsFolder: path.join(__dirname, "migrations") });

for (const migration of migrations) {
  if (migration.folderMillis <= lastAppliedAt) continue;

  for (const statement of migration.sql) {
    if (!statement.trim()) continue;
    try {
      await db.execute(sql.raw(statement));
    } catch (error) {
      const errno = (error as { errno?: number }).errno;
      if (errno && ALREADY_APPLIED_ERRNOS.has(errno)) {
        console.warn(`[migrate] skipping already-applied statement (errno ${errno}): ${statement.slice(0, 80)}...`);
        continue;
      }
      throw error;
    }
  }

  await db.execute(
    sql`insert into ${sql.identifier(MIGRATIONS_TABLE)} (\`hash\`, \`created_at\`) values (${migration.hash}, ${migration.folderMillis})`,
  );
}

console.log("[migrate] done");
process.exit(0);
