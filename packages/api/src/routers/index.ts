import type { RouterClient } from "@orpc/server";
import { createExtensionRouter } from "@struxa/extension-host";

import { publicProcedure } from "../index";
import { locationsRouter } from "./locations";
import { nodesRouter } from "./nodes";
import { allocationsRouter } from "./allocations";
import { nestsRouter } from "./nests";
import { eggsRouter } from "./eggs";
import { serversRouter } from "./servers";
import { backupsRouter } from "./backups";
import { schedulesRouter } from "./schedules";
import { databaseHostsRouter } from "./database-hosts";
import { databasesRouter } from "./databases";
import { subusersRouter } from "./subusers";
import { activityRouter } from "./activity";
import { filesRouter } from "./files";
import { usersRouter } from "./users";
import { settingsRouter } from "./settings";
import { onboardingRouter } from "./onboarding";
import { emailRouter } from "./email";
import { extensionsRouter } from "./extensions";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  locations: locationsRouter,
  nodes: nodesRouter,
  allocations: allocationsRouter,
  nests: nestsRouter,
  eggs: eggsRouter,
  servers: serversRouter,
  backups: backupsRouter,
  schedules: schedulesRouter,
  databaseHosts: databaseHostsRouter,
  databases: databasesRouter,
  subusers: subusersRouter,
  activity: activityRouter,
  files: filesRouter,
  users: usersRouter,
  settings: settingsRouter,
  onboarding: onboardingRouter,
  email: emailRouter,
  extensions: extensionsRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

/**
 * The router actually served per request: the static core router plus the live
 * extension namespace (`ext.<id>.*`) read from the extension registry. Built
 * lazily by the route handler after the boot loader has activated extensions,
 * so newly registered routers are present. The host client (`AppRouterClient`)
 * intentionally does not include `ext` — extension UIs call their own endpoints
 * via the iframe SDK, not the host's typed client.
 */
export function createFullRouter() {
  return {
    ...appRouter,
    ext: createExtensionRouter(),
  };
}
