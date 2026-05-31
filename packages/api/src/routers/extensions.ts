import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { sql, and, eq, inArray } from "drizzle-orm";
import { db, extensions, servers, subusers, settings } from "@struxa/db";
import { like } from "drizzle-orm";
import {
  extensionRegistry,
  emitToExtension,
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

  /**
   * Read the value published by an extension for a named output field, e.g.
   * `{ entity: "server", field: "address", entityId: "abc" }`. Returns null if
   * no active extension has set a value for this slot.
   *
   * Authorization: entity access is verified before returning — callers can only
   * read outputs for entities they already have access to.
   */
  getFieldOutput: protectedProcedure
    .input(z.object({ entity: z.string(), field: z.string(), entityId: z.string() }))
    .handler(async ({ context, input }) => {
      const { entity, field, entityId } = input;
      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";

      if (entity === "server") {
        const server = await db.query.servers.findFirst({
          where: eq(servers.uuid, entityId),
          columns: { id: true, userId: true },
        });
        if (!server) throw new ORPCError("NOT_FOUND");
        if (!isAdmin && server.userId !== userId) {
          const sub = await db.query.subusers.findFirst({
            where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
          });
          if (!sub) throw new ORPCError("FORBIDDEN");
        }
      } else {
        // Unknown entity type — reject rather than silently leaking data
        throw new ORPCError("NOT_FOUND");
      }

      return { value: extensionRegistry.getFieldOutput(entity, field, entityId) };
    }),

  // ---- Extension server settings ----

  /**
   * Returns all active extensions that declare `ui.serverSettings` fields and
   * have been granted `core.metadata:server`, merged with their current stored
   * values for the given server. Caller must have access to the server.
   */
  getServerSettings: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ context, input }) => {
      type FieldOut = {
        key: string; label: string; description: string | null;
        type: string; placeholder: string | null; value: string;
      };
      type ExtOut = { extId: string; extName: string; fields: FieldOut[] };

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";

      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        columns: { id: true, userId: true, metadata: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const activeExts = extensionRegistry.active().filter(
        (e) => (e.manifest.ui?.serverSettings ?? []).length > 0,
      );
      if (!activeExts.length) return [] as ExtOut[];

      const extRows = await db.query.extensions.findMany({
        where: inArray(extensions.id, activeExts.map((e) => e.id)),
        columns: { id: true, grantedPermissions: true },
      });
      const grantMap = new Map(
        extRows.map((r) => [r.id, (r.grantedPermissions as string[] | null) ?? []]),
      );

      const serverMeta = (server.metadata ?? {}) as Record<string, Record<string, unknown>>;
      const result: ExtOut[] = [];

      for (const e of activeExts) {
        if (!grantMap.get(e.id)?.includes("core.metadata:server")) continue;
        const extMeta = serverMeta[e.id] ?? {};
        const fields: FieldOut[] = (e.manifest.ui?.serverSettings ?? []).map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description ?? null,
          type: f.type,
          placeholder: f.placeholder ?? null,
          value: String(extMeta[f.key] ?? ""),
        }));
        result.push({ extId: e.id, extName: e.manifest.name, fields });
      }

      return result;
    }),

  /**
   * Save one extension-declared server setting. Fires `server.settings.saved`
   * to that extension's handlers only. Caller must have server access; the
   * extension must be active with `core.metadata:server` granted and the key
   * must be declared in its manifest.
   */
  saveServerSetting: protectedProcedure
    .input(z.object({ serverId: z.string(), extId: z.string(), key: z.string(), value: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";

      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        columns: { id: true, userId: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const ext = extensionRegistry.get(input.extId);
      if (!ext || ext.status !== "active") throw new ORPCError("NOT_FOUND");

      const extRow = await db.query.extensions.findFirst({
        where: eq(extensions.id, input.extId),
        columns: { grantedPermissions: true },
      });
      const granted = (extRow?.grantedPermissions as string[] | null) ?? [];
      if (!granted.includes("core.metadata:server")) throw new ORPCError("FORBIDDEN");

      const declaredKeys = (ext.manifest.ui?.serverSettings ?? []).map((f) => f.key);
      if (!declaredKeys.includes(input.key)) throw new ORPCError("NOT_FOUND");

      // Write via the same atomic JSON_SET pattern used by coreMeta
      if (!/^[a-z][a-z0-9-]{1,62}$/.test(input.extId)) throw new ORPCError("BAD_REQUEST");
      const path = `$."${input.extId}"`;
      const patchJson = JSON.stringify({ [input.key]: input.value });
      await db.update(servers).set({
        metadata: sql`JSON_SET(
          COALESCE(${servers.metadata}, JSON_OBJECT()),
          ${path},
          JSON_MERGE_PATCH(
            COALESCE(JSON_EXTRACT(${servers.metadata}, ${path}), JSON_OBJECT()),
            CAST(${patchJson} AS JSON)
          )
        )`,
      }).where(eq(servers.id, server.id));

      emitToExtension(input.extId, "server.settings.saved", {
        serverId: input.serverId,
        key: input.key,
        value: input.value,
      });
    }),

  // ---- Extension admin settings tabs ----

  /**
   * All active extensions that declare `ui.adminSettingsTabs`, with current
   * stored values merged in. Password field values are replaced with a sentinel
   * so the browser knows one is set without receiving the raw secret.
   */
  getAdminSettingsTabs: adminProcedure.handler(async () => {
    type FieldOut = {
      key: string; label: string; description: string | null;
      type: string; placeholder: string | null;
      options: Array<{ value: string; label: string }> | null;
      value: string;
    };
    type SectionOut = { title: string; description: string | null; fields: FieldOut[] };
    type TabOut = { extId: string; extName: string; tabId: string; label: string; sections: SectionOut[] };

    const activeExts = extensionRegistry.active().filter(
      (e) => (e.manifest.ui?.adminSettingsTabs ?? []).length > 0,
    );
    if (!activeExts.length) return [] as TabOut[];

    const result: TabOut[] = [];

    for (const ext of activeExts) {
      const ns = `ext:${ext.id}:`;
      const rows = await db
        .select()
        .from(settings)
        .where(like(settings.key, `${ns}%`));
      const valMap = Object.fromEntries(
        rows.map((r) => [r.key.slice(ns.length), r.value ?? ""]),
      );

      for (const tab of ext.manifest.ui?.adminSettingsTabs ?? []) {
        result.push({
          extId: ext.id,
          extName: ext.manifest.name,
          tabId: tab.id,
          label: tab.label,
          sections: tab.sections.map((sec) => ({
            title: sec.title,
            description: sec.description ?? null,
            fields: sec.fields.map((f) => ({
              key: f.key,
              label: f.label,
              description: f.description ?? null,
              type: f.type,
              placeholder: f.placeholder ?? null,
              options: f.options ?? null,
              value: f.type === "password" && valMap[f.key] ? "__set__" : (valMap[f.key] ?? ""),
            })),
          })),
        });
      }
    }

    return result;
  }),

  /**
   * Batch-save one extension's admin settings tab values. Fires
   * `admin.settings.saved` only to that extension's handlers.
   */
  saveAdminSettings: adminProcedure
    .input(
      z.object({
        extId: z.string(),
        tabId: z.string(),
        values: z.record(z.string(), z.string()),
      }),
    )
    .handler(async ({ input }) => {
      const ext = extensionRegistry.get(input.extId);
      if (!ext || ext.status !== "active") throw new ORPCError("NOT_FOUND");

      const tab = (ext.manifest.ui?.adminSettingsTabs ?? []).find(
        (t) => t.id === input.tabId,
      );
      if (!tab) throw new ORPCError("NOT_FOUND");

      const declaredKeys = new Set(
        tab.sections.flatMap((s) => s.fields.map((f) => f.key)),
      );
      const ns = `ext:${input.extId}:`;
      const changes: Record<string, string> = {};

      for (const [key, value] of Object.entries(input.values)) {
        if (!declaredKeys.has(key)) continue;
        // Skip password sentinel — means the client didn't change it
        if (value === "__set__") continue;
        changes[key] = value;
        await db
          .insert(settings)
          .values({ key: ns + key, value })
          .onDuplicateKeyUpdate({ set: { value } });
      }

      if (Object.keys(changes).length > 0) {
        emitToExtension(input.extId, "admin.settings.saved", {
          tabId: input.tabId,
          changes,
        });
      }
    }),

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
        .set({ enabled: false, status: "disabled" })
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
