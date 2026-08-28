import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { locationsRouter } from "./locations";
import { nodesRouter } from "./nodes";
import { allocationsRouter } from "./allocations";
import { nestsRouter } from "./nests";
import { eggsRouter } from "./eggs";
import { serversRouter } from "./servers";
import { backupsRouter } from "./backups";
import { backupDestinationsRouter } from "./backup-destinations";
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
import { googleDriveRouter } from "./google-drive";
import { notificationsRouter } from "./notifications";

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
  backupDestinations: backupDestinationsRouter,
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
  googleDrive: googleDriveRouter,
  notifications: notificationsRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
