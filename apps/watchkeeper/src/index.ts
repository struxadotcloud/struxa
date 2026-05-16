import { config } from "dotenv";
import { resolve } from "path";

if (process.env["NODE_ENV"] !== "production") {
  const envPath = process.env["DOTENV_PATH"] ?? resolve(import.meta.dirname, "../../web/.env");
  config({ path: envPath });
}

const { runStatusWorker } = await import("./workers/status.ts");
const { runScheduleWorker } = await import("./workers/schedules.ts");

console.log("[watchkeeper] starting");

await Promise.all([runStatusWorker(), runScheduleWorker()]);
