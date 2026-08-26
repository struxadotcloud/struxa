import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiSrc = join(web, "..", "..", "packages", "api", "src");

const events = new Set();
for (const f of readdirSync(apiSrc, { recursive: true })) {
  if (!/\.ts$/.test(f)) continue;
  for (const m of readFileSync(join(apiSrc, f), "utf8").matchAll(/"(admin:[a-z0-9.-]+)"/g)) {
    events.add(m[1]);
  }
}

const gaps = [];
for (const file of readdirSync(join(web, "messages"))) {
  const msgs = JSON.parse(readFileSync(join(web, "messages", file), "utf8"));
  const e = msgs.admin?.activity?.events;
  if (!e) { gaps.push(`${file}: missing admin.activity.events`); continue; }
  if (typeof e.unknown !== "string") gaps.push(`${file}: missing events.unknown`);
  for (const ev of events) {
    const path = ev.replace(/^admin:/, "");
    const dot = path.lastIndexOf(".");
    if (dot < 0) continue;
    const resource = path.slice(0, dot).replace(/\./g, "_");
    const action = path.slice(dot + 1);
    if (!e.resource?.[resource]) gaps.push(`${file}: missing events.resource.${resource} (${ev})`);
    if (!e.action?.[action]) gaps.push(`${file}: missing events.action.${action} (${ev})`);
  }
}

if (gaps.length) {
  console.error(gaps.join("\n"));
  console.error(`\n${gaps.length} untranslated activity event part(s).`);
  process.exit(1);
}
console.log(`activity i18n ok — ${events.size} admin event types resolve in all locales`);
