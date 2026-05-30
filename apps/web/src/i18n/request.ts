import { readFile } from "node:fs/promises";
import path from "node:path";

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { extensionRegistry } from "@struxa/extension-host";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  // Merge each active extension's messages under the `ext.<id>` namespace so
  // host-rendered extension bits can be localized without colliding with core
  // keys. Best-effort: a missing/invalid file just yields no extra messages.
  const ext: Record<string, unknown> = {};
  for (const e of extensionRegistry.active()) {
    const rel = e.manifest.messages?.[locale] ?? e.manifest.messages?.en;
    if (!rel) continue;
    try {
      const raw = await readFile(path.join(e.dir, rel), "utf8");
      ext[e.id] = JSON.parse(raw);
    } catch {
      // ignore — extension simply contributes no host-side messages
    }
  }

  return {
    locale,
    messages: { ...messages, ext },
  };
});
