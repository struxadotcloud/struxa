import { db, extensions } from "@struxa/db";
import {
  manifestSchema,
  type Manifest,
  type ManifestUiPage,
  type ManifestUiSlot,
} from "@struxa/extension-sdk";
import { and, eq } from "drizzle-orm";

import { extensionDir } from "./loader";

/**
 * DB-backed catalog of enabled extensions. This is the source of truth for
 * everything UI-facing (sidebar nav, the iframe host pages, the bundle server),
 * because — unlike the in-memory registry — it is consistent across Next's
 * separate server module graphs (RSC pages vs route handlers) and never depends
 * on the extension's server code having loaded.
 *
 * The in-memory `extensionRegistry` remains the source of truth only for the
 * server *runtime* (oRPC routers mounted in the RPC handler, hook handlers),
 * which lives in the route-handler/instrumentation context where the loader runs.
 */
export interface EnabledExtension {
  id: string;
  version: string;
  /** Absolute path to the extracted package on disk. */
  dir: string;
  manifest: Manifest;
}

/** All enabled extensions with a valid stored manifest. */
export async function listEnabledExtensions(): Promise<EnabledExtension[]> {
  const rows = await db
    .select()
    .from(extensions)
    .where(eq(extensions.enabled, true));

  const out: EnabledExtension[] = [];
  for (const row of rows) {
    const parsed = manifestSchema.safeParse(row.manifest);
    if (!parsed.success) continue;
    out.push({
      id: row.id,
      version: row.version,
      dir: extensionDir(row.id, row.version),
      manifest: parsed.data,
    });
  }
  return out;
}

/** A single enabled extension by id. */
export async function getEnabledExtension(
  id: string,
): Promise<EnabledExtension | undefined> {
  const row = (
    await db
      .select()
      .from(extensions)
      .where(and(eq(extensions.id, id), eq(extensions.enabled, true)))
      .limit(1)
  )[0];
  if (!row) return undefined;
  const parsed = manifestSchema.safeParse(row.manifest);
  if (!parsed.success) return undefined;
  return {
    id: row.id,
    version: row.version,
    dir: extensionDir(row.id, row.version),
    manifest: parsed.data,
  };
}

/** Find the enabled extension owning a host route like "/x/foo/admin". */
export async function resolveEnabledPage(
  route: string,
): Promise<{ ext: EnabledExtension; page: ManifestUiPage } | undefined> {
  for (const ext of await listEnabledExtensions()) {
    const page = (ext.manifest.ui?.pages ?? []).find((p) => p.route === route);
    if (page) return { ext, page };
  }
  return undefined;
}

/** Enabled pages contributed to a sidebar section. */
export async function pagesForSection(
  section: "panel" | "admin",
): Promise<Array<ManifestUiPage & { extId: string }>> {
  const exts = await listEnabledExtensions();
  return exts.flatMap((e) =>
    (e.manifest.ui?.pages ?? [])
      .filter((p) => p.section === section)
      .map((p) => ({ ...p, extId: e.id })),
  );
}

/** Enabled widgets registered for a named slot. */
export async function slotsByName(
  name: string,
): Promise<Array<ManifestUiSlot & { extId: string }>> {
  const exts = await listEnabledExtensions();
  return exts.flatMap((e) =>
    (e.manifest.ui?.slots ?? [])
      .filter((s) => s.slot === name)
      .map((s) => ({ ...s, extId: e.id })),
  );
}
