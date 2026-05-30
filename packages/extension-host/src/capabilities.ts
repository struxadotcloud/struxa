import { db, nodes, servers, settings, user } from "@struxa/db";
import type {
  CoreMetaClient,
  ExtensionContext,
  ExtensionLogger,
  ProcedureBuilder,
  ScopedProcedures,
  ScopedSettings,
} from "@struxa/extension-sdk/server";
import type { CoreMetaEntity } from "@struxa/extension-sdk";
import { eq, like } from "drizzle-orm";

import { subscribe } from "./hooks";

/** The host's real, context-bound oRPC builders, injected by the app layer. */
export interface HostProcedures {
  publicProcedure: ProcedureBuilder;
  protectedProcedure: ProcedureBuilder;
  adminProcedure: ProcedureBuilder;
}

const META_TABLES = {
  server: servers,
  node: nodes,
  user: user,
} as const;

function prefixedLogger(extId: string): ExtensionLogger {
  const tag = `[ext:${extId}]`;
  return {
    info: (m, meta) => console.log(tag, m, meta ?? ""),
    warn: (m, meta) => console.warn(tag, m, meta ?? ""),
    error: (m, meta) => console.error(tag, m, meta ?? ""),
  };
}

/** Read/write only this extension's namespaced slice of an entity's metadata. */
function makeCoreMeta(extId: string, entity: CoreMetaEntity): CoreMetaClient {
  const table = META_TABLES[entity];
  return {
    async get(id) {
      const row = await db
        .select({ metadata: table.metadata })
        .from(table)
        .where(eq(table.id, id))
        .limit(1);
      const meta = row[0]?.metadata as Record<string, unknown> | null | undefined;
      const slice = meta?.[extId];
      return (slice as Record<string, unknown>) ?? null;
    },
    async set(id, patch) {
      const row = await db
        .select({ metadata: table.metadata })
        .from(table)
        .where(eq(table.id, id))
        .limit(1);
      const current = (row[0]?.metadata as Record<string, unknown> | null) ?? {};
      const next = {
        ...current,
        [extId]: { ...((current[extId] as Record<string, unknown>) ?? {}), ...patch },
      };
      await db.update(table).set({ metadata: next }).where(eq(table.id, id));
    },
  };
}

/** Settings get/set fenced to keys stored under `ext:<extId>:*`. */
function makeScopedSettings(extId: string): ScopedSettings {
  const ns = `ext:${extId}:`;
  return {
    async get(key) {
      const row = await db
        .select()
        .from(settings)
        .where(eq(settings.key, ns + key))
        .limit(1);
      return row[0]?.value ?? null;
    },
    async set(key, value) {
      await db
        .insert(settings)
        .values({ key: ns + key, value })
        .onDuplicateKeyUpdate({ set: { value } });
    },
    async all() {
      const rows = await db
        .select()
        .from(settings)
        .where(like(settings.key, ns + "%"));
      return Object.fromEntries(
        rows.map((r) => [r.key.slice(ns.length), r.value ?? ""]),
      );
    },
  };
}

function parseEntity(perm: string): CoreMetaEntity | null {
  const m = /^core\.metadata:(server|node|user)$/.exec(perm);
  return m ? (m[1] as CoreMetaEntity) : null;
}

/**
 * Build the capability-scoped context handed to an extension's `register`.
 * Only the approved permissions produce live capabilities; everything else is
 * absent. Enforcement of the `db:own` table fence happens at migration time
 * (see migrator) — the raw handle is provided for the semi-trusted model and a
 * future hardening phase can swap it for a proxied/worker-isolated client.
 */
export function buildContext(opts: {
  extId: string;
  version: string;
  permissions: string[];
  procedures: HostProcedures;
}): ExtensionContext {
  const { extId, version, permissions, procedures } = opts;
  const has = (p: string) => permissions.includes(p);

  // coreMeta clients, one per granted entity.
  const coreMeta: Partial<Record<CoreMetaEntity, CoreMetaClient>> = {};
  for (const perm of permissions) {
    const entity = parseEntity(perm);
    if (entity) coreMeta[entity] = makeCoreMeta(extId, entity);
  }

  // Procedure builders capped by the highest granted api level.
  const scoped: ScopedProcedures = {};
  if (has("api:public") || has("api:protected") || has("api:admin")) {
    scoped.publicProcedure = procedures.publicProcedure;
  }
  if (has("api:protected") || has("api:admin")) {
    scoped.protectedProcedure = procedures.protectedProcedure;
  }
  if (has("api:admin")) {
    scoped.adminProcedure = procedures.adminProcedure;
  }

  // Hook subscription gated per `hook:<event>` permission.
  const hookEvents = new Set(
    permissions
      .filter((p) => p.startsWith("hook:"))
      .map((p) => p.slice("hook:".length)),
  );

  return {
    extId,
    version,
    logger: prefixedLogger(extId),
    // The scoped handle is the same underlying connection; the SDK types it
    // with an empty schema (extensions pass their own table objects). Cast
    // through unknown to bridge the differing schema generic.
    db: has("db:own")
      ? (db as unknown as ExtensionContext["db"])
      : undefined,
    coreMeta,
    settings: makeScopedSettings(extId),
    hooks: {
      on: (event, handler) => {
        if (!hookEvents.has(event)) {
          console.warn(
            `[extensions] ${extId} subscribed to "${event}" without hook:${event} permission; ignored`,
          );
          return;
        }
        subscribe(extId, event, handler as (p: Record<string, unknown>) => void);
      },
    },
    procedures: scoped,
  };
}
