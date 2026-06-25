import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));

const raw = readFileSync(resolve(dir, "../web/.env"), "utf8");
const fileEnv = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

spawnSync("go", ["run", "."], {
  stdio: "inherit",
  cwd: dir,
  env: { ...process.env, ...fileEnv, GOCACHE: resolve(dir, ".go-cache") },
});
