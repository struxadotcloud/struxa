import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, extensions } from "@struxa/db";
import {
  extensionRegistry,
  forgetExtensionMigrations,
  dropExtensionTables,
  installExtension,
  listAvailableExtensions,
  pagesForSection,
  reloadExtension,
  slotsByName,
  unsubscribeExtension,
  uninstallExtensionFiles,
} from "@struxa/extension-host";
import { eq } from "drizzle-orm";

import { adminProcedure, protectedProcedure } from "../index";

/**
 * Extensions API. Read procedures (uiPages/slots) drive the client shells;
 * admin procedures drive the marketplace lifecycle (install -> disable/uninstall).
 * All declared permissions are automatically granted on install; there is no
 * separate approve step. Server-side activation happens via the registry/loader
 * in `@struxa/extension-host`.
 */
export const extensionsRouter = {
  /** Enabled extension pages contributed to a sidebar section (DB-backed). */
  uiPages: protectedProcedure
    .input(z.object({ section: z.enum(["panel", "admin"]) }))
    .handler(async ({ input }) =>
      (await pagesForSection(input.section)).map((p) => ({
        extId: p.extId,
        route: p.route,
        label: p.label,
        icon: p.icon ?? null,
      })),
    ),

  /** Widgets registered for a named slot (used by <ExtensionSlot>). */
  slots: protectedProcedure
    .input(z.object({ name: z.string() }))
    .handler(async ({ input }) =>
      (await slotsByName(input.name)).map((s) => ({
        extId: s.extId,
        widget: s.widget,
      })),
    ),

  // ---- Admin lifecycle ----

  /** Marketplace catalog from the configured registry. */
  listAvailable: adminProcedure.handler(() => listAvailableExtensions()),

  /** Everything installed on this instance, with runtime status. */
  listInstalled: adminProcedure.handler(async () => {
    const rows = await db.select().from(extensions);
    return rows.map((r) => ({
      ...r,
      runtimeStatus: extensionRegistry.get(r.id)?.status ?? null,
    }));
  }),

  /** Combined registry + installed state for a single extension detail view. */
  getDetails: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const [catalog, installed] = await Promise.all([
        listAvailableExtensions().catch(() => []),
        db.select().from(extensions).where(eq(extensions.id, input.id)).limit(1),
      ]);
      const registry = catalog.find((e) => e.id === input.id) ?? null;
      const row = installed[0] ?? null;
      if (!registry && !row) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });
      return {
        registry,
        installed: row
          ? { ...row, runtimeStatus: extensionRegistry.get(row.id)?.status ?? null }
          : null,
      };
    }),

  /** Download + verify + extract a package. Leaves it disabled, no grants. */
  install: adminProcedure
    .input(z.object({ id: z.string(), version: z.string() }))
    .handler(async ({ input }) => {
      const catalog = await listAvailableExtensions();
      const entry = catalog.find(
        (e) => e.id === input.id && e.version === input.version,
      );
      if (!entry) throw new ORPCError("NOT_FOUND", { message: "Not in registry" });

      const manifest = await installExtension(entry);

      await db
        .insert(extensions)
        .values({
          id: manifest.id,
          version: manifest.version,
          sourceUrl: entry.tarball,
          manifest,
          grantedPermissions: manifest.permissions ?? [],
          enabled: true,
          status: "installed",
        })
        .onDuplicateKeyUpdate({
          set: {
            version: manifest.version,
            sourceUrl: entry.tarball,
            manifest,
            grantedPermissions: manifest.permissions ?? [],
            enabled: true,
            status: "installed",
            lastError: null,
          },
        });

      await reloadExtension(manifest.id);
      return { id: manifest.id };
    }),

  /** Grant the admin-approved subset of the manifest's requested permissions. */
  approvePermissions: adminProcedure
    .input(z.object({ id: z.string(), permissions: z.array(z.string()) }))
    .handler(async ({ input }) => {
      await db
        .update(extensions)
        .set({ grantedPermissions: input.permissions })
        .where(eq(extensions.id, input.id));
      // If the extension is already enabled, re-load so the new grants take
      // effect immediately (e.g. its API routes/hooks appear without a restart).
      const row = (
        await db
          .select({ enabled: extensions.enabled })
          .from(extensions)
          .where(eq(extensions.id, input.id))
          .limit(1)
      )[0];
      if (row?.enabled) await reloadExtension(input.id);
    }),

  /** Enable + load (hot-activate) an installed extension. */
  enable: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      await db
        .update(extensions)
        .set({ enabled: true })
        .where(eq(extensions.id, input.id));
      await reloadExtension(input.id);
    }),

  /** Disable + tear down its hooks/router without removing files. */
  disable: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      await db
        .update(extensions)
        .set({ enabled: false })
        .where(eq(extensions.id, input.id));
      unsubscribeExtension(input.id);
      extensionRegistry.remove(input.id);
    }),

  /** Fully remove: files, owned-migration ledger, registry, and DB row. */
  uninstall: adminProcedure
    .input(z.object({ id: z.string(), dropTables: z.boolean().default(false) }))
    .handler(async ({ input }) => {
      const row = (
        await db.select().from(extensions).where(eq(extensions.id, input.id)).limit(1)
      )[0];
      if (!row) return;
      unsubscribeExtension(input.id);
      extensionRegistry.remove(input.id);
      await uninstallExtensionFiles(row.id, row.version);
      if (input.dropTables) await dropExtensionTables(row.id);
      await forgetExtensionMigrations(row.id);
      await db.delete(extensions).where(eq(extensions.id, input.id));
    }),
};
