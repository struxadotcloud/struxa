import { relations } from "drizzle-orm";
import { user } from "./auth";
import { locations } from "./locations";
import { nodes } from "./nodes";
import { nodeAllocations } from "./allocations";
import { nests } from "./nests";
import { eggs } from "./eggs";
import { eggVariables } from "./egg-variables";
import { databaseHosts } from "./database-hosts";
import { servers } from "./servers";
import { serverVariables } from "./server-variables";
import { mounts } from "./mounts";
import { serverMounts } from "./server-mounts";
import { serverDatabases } from "./server-databases";
import { backups } from "./backups";
import { schedules, scheduleTasks } from "./schedules";
import { subusers } from "./subusers";
import { activityLogs } from "./activity-logs";
import { servers as serversTable } from "./servers";
import { nodes as nodesTable } from "./nodes";

export const locationsRelations = relations(locations, ({ many }) => ({
  nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  location: one(locations, {
    fields: [nodes.locationId],
    references: [locations.id],
  }),
  allocations: many(nodeAllocations),
  servers: many(servers),
}));

export const nodeAllocationsRelations = relations(
  nodeAllocations,
  ({ one }) => ({
    node: one(nodes, {
      fields: [nodeAllocations.nodeId],
      references: [nodes.id],
    }),
  }),
);

export const nestsRelations = relations(nests, ({ many }) => ({
  eggs: many(eggs),
}));

export const eggsRelations = relations(eggs, ({ one, many }) => ({
  nest: one(nests, {
    fields: [eggs.nestId],
    references: [nests.id],
  }),
  variables: many(eggVariables),
  servers: many(servers),
}));

export const eggVariablesRelations = relations(eggVariables, ({ one }) => ({
  egg: one(eggs, {
    fields: [eggVariables.eggId],
    references: [eggs.id],
  }),
}));

export const databaseHostsRelations = relations(databaseHosts, ({ many }) => ({
  serverDatabases: many(serverDatabases),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  user: one(user, {
    fields: [servers.userId],
    references: [user.id],
  }),
  node: one(nodes, {
    fields: [servers.nodeId],
    references: [nodes.id],
  }),
  egg: one(eggs, {
    fields: [servers.eggId],
    references: [eggs.id],
  }),
  allocation: one(nodeAllocations, {
    fields: [servers.allocationId],
    references: [nodeAllocations.id],
  }),
  variables: many(serverVariables),
  databases: many(serverDatabases),
  backups: many(backups),
  schedules: many(schedules),
  subusers: many(subusers),
  mounts: many(serverMounts),
}));

export const serverVariablesRelations = relations(serverVariables, ({ one }) => ({
  server: one(servers, {
    fields: [serverVariables.serverId],
    references: [servers.id],
  }),
  variable: one(eggVariables, {
    fields: [serverVariables.variableId],
    references: [eggVariables.id],
  }),
}));

export const mountsRelations = relations(mounts, ({ many }) => ({
  servers: many(serverMounts),
}));

export const serverMountsRelations = relations(serverMounts, ({ one }) => ({
  server: one(servers, {
    fields: [serverMounts.serverId],
    references: [servers.id],
  }),
  mount: one(mounts, {
    fields: [serverMounts.mountId],
    references: [mounts.id],
  }),
}));

export const serverDatabasesRelations = relations(serverDatabases, ({ one }) => ({
  server: one(servers, {
    fields: [serverDatabases.serverId],
    references: [servers.id],
  }),
  host: one(databaseHosts, {
    fields: [serverDatabases.hostId],
    references: [databaseHosts.id],
  }),
}));

export const backupsRelations = relations(backups, ({ one }) => ({
  server: one(servers, {
    fields: [backups.serverId],
    references: [servers.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  server: one(servers, {
    fields: [schedules.serverId],
    references: [servers.id],
  }),
  tasks: many(scheduleTasks),
}));

export const scheduleTasksRelations = relations(scheduleTasks, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduleTasks.scheduleId],
    references: [schedules.id],
  }),
}));

export const subusersRelations = relations(subusers, ({ one }) => ({
  user: one(user, {
    fields: [subusers.userId],
    references: [user.id],
  }),
  server: one(servers, {
    fields: [subusers.serverId],
    references: [servers.id],
  }),
}));

export const userExtendedRelations = relations(user, ({ many }) => ({
  servers: many(servers),
  subusers: many(subusers),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(user, {
    fields: [activityLogs.userId],
    references: [user.id],
  }),
  server: one(serversTable, {
    fields: [activityLogs.serverId],
    references: [serversTable.id],
  }),
  node: one(nodesTable, {
    fields: [activityLogs.nodeId],
    references: [nodesTable.id],
  }),
}));
