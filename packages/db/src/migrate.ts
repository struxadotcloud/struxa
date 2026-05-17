import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
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

console.log("[migrate] running migrations...");
await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
console.log("[migrate] done");
process.exit(0);
