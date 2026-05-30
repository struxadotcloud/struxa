import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { db, extensions } from "@struxa/db";
import { env } from "@struxa/env/server";
import {
  HOST_API_VERSION,
  manifestSchema,
  type Manifest,
} from "@struxa/extension-sdk";
import type { ExtensionDefinition } from "@struxa/extension-sdk/server";
import { eq } from "drizzle-orm";

import { buildContext, type HostProcedures } from "./capabilities";
import { unsubscribeExtension } from "./hooks";
import { runExtensionMigrations } from "./migrator";
import { extensionRegistry } from "./registry";
import { satisfies } from "./semver";

/**
 * Bundler-safe dynamic import. Extension server code lives outside the project,
 * on the data volume, so it must be imported by the Node runtime — not resolved
 * through Next's Turbopack/webpack module runtime (which statically analyzes
 * `import()` and would fail on a computed external path). Wrapping in `Function`
 * makes the call opaque to the bundler so it defers to native ESM import.
 */
const nativeImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<{ default?: ExtensionDefinition }>;

/** Absolute path of an extracted package: `${EXTENSIONS_DIR}/<id>@<version>`. */
export function extensionDir(id: string, version: string): string {
  return path.join(env.EXTENSIONS_DIR, `${id}@${version}`);
}

/**
 * The host's oRPC builders, set once by the app layer at boot (via
 * `configureHost`). Stored here so lifecycle operations triggered from the API
 * (enable/reload) can load extensions without the API package importing the app.
 */
let hostProcedures: HostProcedures | null = null;

export function configureHost(procedures: HostProcedures): void {
  hostProcedures = procedures;
}

function requireProcedures(): HostProcedures {
  if (!hostProcedures) {
    throw new Error("extension host not configured: call configureHost() at boot");
  }
  return hostProcedures;
}

async function readManifest(dir: string): Promise<Manifest> {
  const raw = await readFile(path.join(dir, "manifest.json"), "utf8");
  return manifestSchema.parse(JSON.parse(raw));
}

async function markErrored(id: string, message: string): Promise<void> {
  await db
    .update(extensions)
    .set({ status: "errored", lastError: message.slice(0, 2048) })
    .where(eq(extensions.id, id))
    .catch(() => {});
}

/**
 * Load (or reload) a single extension into the registry. Failures are isolated:
 * the extension is marked `errored` and skipped; it never throws to the caller.
 */
export async function loadExtension(
  row: { id: string; version: string; grantedPermissions: string[] },
  procedures: HostProcedures = requireProcedures(),
): Promise<void> {
  const dir = extensionDir(row.id, row.version);
  // Clean any prior registration so reloads don't leave stale hooks/routers.
  unsubscribeExtension(row.id);

  try {
    const manifest = await readManifest(dir);

    if (!satisfies(manifest.struxaApi, HOST_API_VERSION)) {
      throw new Error(
        `incompatible struxaApi ${manifest.struxaApi} (host ${HOST_API_VERSION})`,
      );
    }

    // Only grant capabilities the admin actually approved.
    const permissions = manifest.permissions.filter((p) =>
      row.grantedPermissions.includes(p),
    );

    if (permissions.includes("db:own")) {
      await runExtensionMigrations({ extId: row.id, dir });
    }

    const ctx = buildContext({
      extId: row.id,
      version: row.version,
      permissions,
      procedures,
    });

    // Server entry is optional (a pure-UI extension may have none).
    let registration: { router?: unknown } = {};
    const serverEntry = path.join(dir, "server", "index.js");
    const serverEntryUrl = pathToFileURL(serverEntry).href;
    try {
      const mod = await nativeImport(serverEntryUrl);
      if (mod.default?.register) {
        registration = (await mod.default.register(ctx)) ?? {};
      }
    } catch (err) {
      // Missing server entry is fine; a transitive missing dep is a real error.
      const e = err as { code?: string; url?: string; message?: string };
      const isEntryMissing =
        e.code === "ERR_MODULE_NOT_FOUND" &&
        (e.url === serverEntryUrl || !!e.message?.includes(serverEntryUrl));
      if (!isEntryMissing) throw err;
    }

    const routerKeys = registration.router
      ? Object.keys(registration.router as Record<string, unknown>)
      : [];
    console.log(
      `[extensions] loaded "${row.id}" — granted: [${permissions.join(", ")}] — ext.${row.id}.* procedures: [${routerKeys.join(", ")}]`,
    );
    if (manifest.permissions.some((p) => p.startsWith("api:")) && routerKeys.length === 0) {
      console.warn(
        `[extensions] "${row.id}" declares an api:* permission but registered no procedures — likely the api:* permission was not approved (check Admin → Extensions → Permissions).`,
      );
    }

    extensionRegistry.set({
      id: row.id,
      version: row.version,
      manifest,
      router: registration.router as never,
      status: "active",
      dir,
    });

    await db
      .update(extensions)
      .set({ status: "installed", lastError: null })
      .where(eq(extensions.id, row.id))
      .catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extensions] failed to load "${row.id}":`, err);
    extensionRegistry.set({
      id: row.id,
      version: row.version,
      manifest: { id: row.id } as Manifest,
      status: "errored",
      error: message,
      dir,
    });
    await markErrored(row.id, message);
  }
}

let loadPromise: Promise<void> | null = null;

/**
 * Load all enabled extensions. Idempotent and guarded by a module-level promise
 * (mirrors the `getAuth()` singleton pattern) so concurrent boot paths share one
 * load. Pass `force` to re-run after an install/enable change.
 */
export function loadExtensions(
  opts: { force?: boolean; procedures?: HostProcedures } = {},
): Promise<void> {
  if (loadPromise && !opts.force) return loadPromise;
  const procedures = opts.procedures ?? requireProcedures();

  loadPromise = (async () => {
    let rows: Array<typeof extensions.$inferSelect>;
    try {
      rows = await db.select().from(extensions).where(eq(extensions.enabled, true));
    } catch (err) {
      // The extensions table may not exist yet (migration not applied). Don't
      // crash boot or poison the memoized promise — just load nothing.
      console.error("[extensions] could not read installed extensions:", err);
      return;
    }

    for (const row of rows) {
      await loadExtension(
        {
          id: row.id,
          version: row.version,
          grantedPermissions: row.grantedPermissions ?? [],
        },
        procedures,
      );
    }
  })();

  return loadPromise;
}

/** Load (or hot-reload) a single extension by id from its current DB row. */
export async function reloadExtension(id: string): Promise<void> {
  const row = (
    await db.select().from(extensions).where(eq(extensions.id, id)).limit(1)
  )[0];
  if (!row) return;
  await loadExtension({
    id: row.id,
    version: row.version,
    grantedPermissions: row.grantedPermissions ?? [],
  });
}
