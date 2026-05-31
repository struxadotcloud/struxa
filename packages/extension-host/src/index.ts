import type { AnyRouter } from "@orpc/server";

import { extensionRegistry } from "./registry";

export { extensionRegistry } from "./registry";
export type { RegisteredExtension } from "./registry";
export {
  loadExtensions,
  loadExtension,
  reloadExtension,
  configureHost,
  extensionDir,
} from "./loader";
export {
  installExtension,
  uninstallExtensionFiles,
  listAvailableExtensions,
} from "./installer";
export {
  listEnabledExtensions,
  getEnabledExtension,
  resolveEnabledPage,
  pagesForSection,
  slotsByName,
} from "./catalog";
export type { EnabledExtension } from "./catalog";
export type { HostProcedures } from "./capabilities";
export { emit, emitToExtension, unsubscribeExtension } from "./hooks";
export { runExtensionMigrations, forgetExtensionMigrations, dropExtensionTables } from "./migrator";

/**
 * Builds the `{ [extId]: router }` map mounted at `appRouter.ext`. Reads the
 * live registry, so it reflects whatever the loader has activated. Called from
 * `@struxa/api`'s root router — this module never imports `@struxa/api`, keeping
 * the dependency one-directional.
 */
export function createExtensionRouter(): Record<string, AnyRouter> {
  return extensionRegistry.routers();
}
