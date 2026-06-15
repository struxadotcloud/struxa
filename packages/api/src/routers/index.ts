import type { RouterClient } from "@orpc/server";

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
import { billingRouter } from "./billing";

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
  billing: billingRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
