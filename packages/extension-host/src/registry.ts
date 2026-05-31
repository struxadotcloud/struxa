import type { Manifest, ManifestUiPage, ManifestUiSlot } from "@struxa/extension-sdk";
import type { AnyRouter } from "@orpc/server";

/**
 * In-memory registry of activated extensions. Deliberately a leaf module with
 * no dependency on `@struxa/api` so the API package can read it (for the `ext`
 * router namespace) without creating a package cycle — the loader, which does
 * depend on the API builders, writes into it.
 */

export type ExtensionRuntimeStatus = "active" | "errored";

export interface RegisteredExtension {
  id: string;
  version: string;
  manifest: Manifest;
  router?: AnyRouter;
  status: ExtensionRuntimeStatus;
  error?: string;
  /** Absolute path to the extracted package dir under EXTENSIONS_DIR. */
  dir: string;
}

class ExtensionRegistry {
  private byId = new Map<string, RegisteredExtension>();
  private listeners = new Set<() => void>();
  /** key: `"entity:field:entityId"`, value: owning extId + published value */
  private fieldOutputMap = new Map<string, { extId: string; value: string }>();

  set(ext: RegisteredExtension): void {
    this.byId.set(ext.id, ext);
    this.emitChange();
  }

  remove(id: string): void {
    if (this.byId.delete(id)) {
      for (const [k, v] of this.fieldOutputMap) {
        if (v.extId === id) this.fieldOutputMap.delete(k);
      }
      this.emitChange();
    }
  }

  clear(): void {
    this.byId.clear();
    this.fieldOutputMap.clear();
    this.emitChange();
  }

  setFieldOutput(entity: string, field: string, entityId: string, value: string, extId: string): void {
    this.fieldOutputMap.set(`${entity}:${field}:${entityId}`, { extId, value });
    this.emitChange();
  }

  clearFieldOutput(entity: string, field: string, entityId: string, extId: string): void {
    const key = `${entity}:${field}:${entityId}`;
    if (this.fieldOutputMap.get(key)?.extId === extId) {
      this.fieldOutputMap.delete(key);
      this.emitChange();
    }
  }

  getFieldOutput(entity: string, field: string, entityId: string): string | null {
    return this.fieldOutputMap.get(`${entity}:${field}:${entityId}`)?.value ?? null;
  }

  get(id: string): RegisteredExtension | undefined {
    return this.byId.get(id);
  }

  all(): RegisteredExtension[] {
    return [...this.byId.values()];
  }

  active(): RegisteredExtension[] {
    return this.all().filter((e) => e.status === "active");
  }

  /** `{ [extId]: router }` for every active extension that exposes one. */
  routers(): Record<string, AnyRouter> {
    const out: Record<string, AnyRouter> = {};
    for (const ext of this.active()) {
      if (ext.router) out[ext.id] = ext.router;
    }
    return out;
  }

  /** UI pages contributed to a given sidebar section, with their owning ext. */
  pages(section: "panel" | "admin"): Array<ManifestUiPage & { extId: string }> {
    return this.active().flatMap((ext) =>
      (ext.manifest.ui?.pages ?? [])
        .filter((p) => p.section === section)
        .map((p) => ({ ...p, extId: ext.id })),
    );
  }

  /** Widgets registered for a named slot, with their owning ext. */
  slots(name: string): Array<ManifestUiSlot & { extId: string }> {
    return this.active().flatMap((ext) =>
      (ext.manifest.ui?.slots ?? [])
        .filter((s) => s.slot === name)
        .map((s) => ({ ...s, extId: ext.id })),
    );
  }

  /** Find the active extension owning a host route like "/x/foo/admin". */
  resolvePage(route: string): { ext: RegisteredExtension; page: ManifestUiPage } | undefined {
    for (const ext of this.active()) {
      const page = (ext.manifest.ui?.pages ?? []).find((p) => p.route === route);
      if (page) return { ext, page };
    }
    return undefined;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const l of this.listeners) l();
  }
}

/** Process-wide singleton. */
export const extensionRegistry = new ExtensionRegistry();
