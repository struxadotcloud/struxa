import "server-only";

import { adminProcedure, protectedProcedure, publicProcedure } from "@struxa/api";
import {
  configureHost,
  loadExtensions,
  type HostProcedures,
} from "@struxa/extension-host";

/**
 * Host wiring for the extension system. Lives in the app layer so it can hand
 * the real oRPC procedure builders to `@struxa/extension-host` without the host
 * package depending on `@struxa/api` (which would create a cycle). Registering
 * them via `configureHost` also lets API-triggered lifecycle ops (enable/reload)
 * load extensions without importing the app layer.
 */
const procedures: HostProcedures = {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
};

configureHost(procedures);

export { procedures as extensionProcedures };

/** Load enabled extensions once at boot. Idempotent. */
export function bootExtensions(): Promise<void> {
  return loadExtensions();
}

/** Re-run the loader after an install/enable/disable change. */
export function reloadExtensions(): Promise<void> {
  return loadExtensions({ force: true });
}
