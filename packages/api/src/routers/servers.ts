import { randomUUID } from "crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import {
  eggVariables,
  eggs,
  nodeAllocations,
  nodes,
  serverVariables,
  servers,
  subusers,
} from "@struxa/db";
import { createWingsClient } from "../lib/wings-client";
import { signWsToken } from "../lib/jwt";
import { buildInvocation } from "../services/wings-servers";
import { adminProcedure, protectedProcedure } from "../index";

export const serversRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const isAdmin = context.session.user.role === "admin";

    const baseColumns = {
      id: true, uuid: true, name: true, description: true, status: true,
      suspended: true, powerState: true, memory: true, disk: true, cpu: true,
    } as const;

    const userListSelect = {
      columns: baseColumns,
      with: {
        allocation: { columns: { ip: true, port: true } },
        egg: { columns: { id: true, uuid: true, name: true } },
      },
    } as const;

    const adminListSelect = {
      columns: baseColumns,
      with: {
        allocation: { columns: { ip: true, port: true } },
        egg: { columns: { id: true, uuid: true, name: true } },
        node: { columns: { id: true, name: true } },
      },
    } as const;

    const rows = isAdmin
      ? await db.query.servers.findMany(adminListSelect)
      : await db.query.servers.findMany({
          where: eq(servers.userId, userId),
          ...userListSelect,
        });

    if (!isAdmin) {
      const subuserServerIds = (
        await db.query.subusers.findMany({
          where: eq(subusers.userId, userId),
        })
      ).map((s) => s.serverId);

      const subuserServers = subuserServerIds.length
        ? await db.query.servers.findMany({
            where: and(
              ...subuserServerIds.map((id) => eq(servers.id, id)),
            ),
            ...userListSelect,
          })
        : [];

      return [
        ...rows,
        ...subuserServers.filter((s) => !rows.find((r) => r.id === s.id)),
      ];
    }

    return rows;
  }),

  listStatuses: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const isAdmin = context.session.user.role === "admin";

    const serverQuery = {
      columns: { uuid: true, nodeId: true } as const,
      with: { node: true } as const,
    };

    const ownServers = isAdmin
      ? await db.query.servers.findMany(serverQuery)
      : await db.query.servers.findMany({ where: eq(servers.userId, userId), ...serverQuery });

    let allServers: typeof ownServers = ownServers;

    if (!isAdmin) {
      const subuserEntries = await db.query.subusers.findMany({
        where: eq(subusers.userId, userId),
        columns: { serverId: true },
      });
      if (subuserEntries.length > 0) {
        const subuserIds = subuserEntries.map((s) => s.serverId);
        const subuserServers = await db.query.servers.findMany({
          where: inArray(servers.id, subuserIds),
          ...serverQuery,
        });
        const ownUuids = new Set(ownServers.map((s) => s.uuid));
        allServers = [...ownServers, ...subuserServers.filter((s) => !ownUuids.has(s.uuid))];
      }
    }

    // Group by node to make one request per node instead of one per server
    const byNode = new Map<string, { node: typeof nodes.$inferSelect; uuids: string[] }>();
    for (const server of allServers) {
      const node = server.node as typeof nodes.$inferSelect;
      if (!byNode.has(server.nodeId)) {
        byNode.set(server.nodeId, { node, uuids: [] });
      }
      byNode.get(server.nodeId)!.uuids.push(server.uuid);
    }

    const statuses: Record<string, string> = {};
    await Promise.allSettled(
      [...byNode.values()].map(async ({ node, uuids }) => {
        try {
          const allowed = new Set(uuids);
          const client = createWingsClient(node);
          const util = await client.getUtilization();
          for (const [uuid, data] of Object.entries(util)) {
            if (allowed.has(uuid)) {
              statuses[uuid] = data.state;
            }
          }
        } catch {
          // Node unreachable — its servers are absent from the map, UI treats them as offline
        }
      }),
    );

    return statuses as Record<string, string>;
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        memory: z.number().int().min(1).optional(),
        disk: z.number().int().min(1).optional(),
        cpu: z.number().int().min(0).optional(),
        swap: z.number().int().optional(),
        io: z.number().int().min(10).max(1000).optional(),
        threads: z.string().nullable().optional(),
        oomDisabled: z.boolean().optional(),
        image: z.string().min(1).optional(),
        startup: z.string().min(1).optional(),
        userId: z.string().optional(),
        nodeId: z.string().uuid().optional(),
        allocationId: z.string().uuid().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const {
        id, startup,
        name, description, memory, disk, cpu, swap, io, threads, oomDisabled, image,
        userId, nodeId, allocationId,
      } = input;

      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, id),
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const updates: {
        name?: string;
        description?: string | null;
        memory?: number;
        disk?: number;
        cpu?: number;
        swap?: number;
        io?: number;
        threads?: string | null;
        oomDisabled?: boolean;
        image?: string;
        startup?: string;
        invocation?: string;
        userId?: string;
        nodeId?: string;
        allocationId?: string;
      } = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (memory !== undefined) updates.memory = memory;
      if (disk !== undefined) updates.disk = disk;
      if (cpu !== undefined) updates.cpu = cpu;
      if (swap !== undefined) updates.swap = swap;
      if (io !== undefined) updates.io = io;
      if (threads !== undefined) updates.threads = threads;
      if (oomDisabled !== undefined) updates.oomDisabled = oomDisabled;
      if (image !== undefined) updates.image = image;
      if (userId !== undefined) updates.userId = userId;
      if (nodeId !== undefined) updates.nodeId = nodeId;

      if (allocationId !== undefined && allocationId !== server.allocationId) {
        await db.update(nodeAllocations).set({ serverId: null }).where(eq(nodeAllocations.id, server.allocationId));
        await db.update(nodeAllocations).set({ serverId: server.id }).where(eq(nodeAllocations.id, allocationId));
        updates.allocationId = allocationId;
      }

      if (startup !== undefined) {
        updates.startup = startup;
        const svars = await db.query.serverVariables.findMany({
          where: eq(serverVariables.serverId, server.id),
          with: { variable: { columns: { envVariable: true, defaultValue: true } } },
        });
        const varMap: Record<string, string> = {};
        for (const sv of svars) {
          varMap[sv.variable.envVariable] = sv.variableValue ?? sv.variable.defaultValue ?? "";
        }
        updates.invocation = buildInvocation(startup, varMap);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(servers).set(updates).where(eq(servers.uuid, id));
      }
    }),

  suspend: adminProcedure
    .input(z.object({ id: z.string(), suspended: z.boolean() }))
    .handler(async ({ input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.id),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      await db.update(servers).set({ suspended: input.suspended }).where(eq(servers.uuid, input.id));

      if (input.suspended && server.powerState !== "offline") {
        const client = createWingsClient(server.node as typeof nodes.$inferSelect);
        try {
          await client.sendPowerAction(server.uuid, "kill");
        } catch {
          // Wings unreachable — DB flag is set; enforcement happens at next Wings contact
        }
      }
    }),

  updateVariables: adminProcedure
    .input(
      z.object({
        id: z.string(),
        variables: z.record(z.string(), z.string()),
        startup: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.id),
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const svars = await db.query.serverVariables.findMany({
        where: eq(serverVariables.serverId, server.id),
        with: { variable: { columns: { envVariable: true, defaultValue: true } } },
      });

      await Promise.all(
        svars
          .filter((sv) => sv.variable.envVariable in input.variables)
          .map((sv) =>
            db
              .update(serverVariables)
              .set({ variableValue: input.variables[sv.variable.envVariable] })
              .where(eq(serverVariables.id, sv.id)),
          ),
      );

      const startupCommand = input.startup ?? server.startup;
      const varMap: Record<string, string> = {};
      for (const sv of svars) {
        varMap[sv.variable.envVariable] =
          input.variables[sv.variable.envVariable] ??
          sv.variableValue ??
          sv.variable.defaultValue ??
          "";
      }

      const serverUpdates: { invocation: string; startup?: string } = {
        invocation: buildInvocation(startupCommand, varMap),
      };
      if (input.startup) serverUpdates.startup = input.startup;

      await db.update(servers).set(serverUpdates).where(eq(servers.uuid, input.id));
    }),

  updateStartupVariable: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        envVariable: z.string(),
        value: z.string(),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const eggVar = await db.query.eggVariables.findFirst({
        where: and(
          eq(eggVariables.eggId, server.eggId),
          eq(eggVariables.envVariable, input.envVariable),
        ),
      });
      if (!eggVar) throw new ORPCError("NOT_FOUND", { message: "Variable not found" });
      if (!eggVar.userEditable && !isAdmin) throw new ORPCError("FORBIDDEN", { message: "Variable is not user-editable" });

      await db
        .update(serverVariables)
        .set({ variableValue: input.value })
        .where(
          and(
            eq(serverVariables.serverId, server.id),
            eq(serverVariables.variableId, eggVar.id),
          ),
        );

      const allVars = await db.query.serverVariables.findMany({
        where: eq(serverVariables.serverId, server.id),
        with: { variable: { columns: { envVariable: true, defaultValue: true } } },
      });
      const varMap: Record<string, string> = {};
      for (const sv of allVars) {
        varMap[sv.variable.envVariable] = sv.variableValue ?? sv.variable.defaultValue ?? "";
      }
      await db
        .update(servers)
        .set({ invocation: buildInvocation(server.startup, varMap) })
        .where(eq(servers.id, server.id));
    }),

  updateDockerImage: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        image: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        with: { egg: { columns: { dockerImages: true } } },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      let validImages: string[] = [];
      try {
        const parsed = JSON.parse(server.egg.dockerImages ?? "{}") as Record<string, string>;
        validImages = Object.keys(parsed);
      } catch {}

      if (validImages.length > 0 && !validImages.includes(input.image)) {
        throw new ORPCError("BAD_REQUEST", { message: "Image not in allowed list" });
      }

      await db
        .update(servers)
        .set({ image: input.image })
        .where(eq(servers.uuid, input.serverId));
    }),

  rename: protectedProcedure
    .input(z.object({ serverId: z.string(), name: z.string().min(1).max(255) }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(eq(subusers.userId, userId), eq(subusers.serverId, server.id)),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      await db.update(servers).set({ name: input.name }).where(eq(servers.uuid, input.serverId));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.id),
        columns: {
          id: true, uuid: true, uuidShort: true, name: true, description: true,
          status: true, suspended: true, powerState: true, memory: true, disk: true,
          cpu: true, swap: true, io: true, threads: true, oomDisabled: true,
          image: true, startup: true, invocation: true, skipScripts: true, userId: true,
        },
        with: {
          allocation: { columns: { ip: true, port: true } },
          node: { columns: { name: true, fqdn: true, daemonSFTP: true } },
          egg: {
            columns: { id: true, uuid: true, name: true, startup: true, dockerImages: true },
            with: {
              variables: {
                columns: {
                  id: true, name: true, envVariable: true, description: true,
                  defaultValue: true, userViewable: true, userEditable: true, rules: true,
                },
              },
            },
          },
        },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(
            eq(subusers.userId, userId),
            eq(subusers.serverId, server.id),
          ),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const variables = await db.query.serverVariables.findMany({
        where: eq(serverVariables.serverId, server.id),
        columns: { variableId: true, variableValue: true },
        with: {
          variable: {
            columns: {
              id: true, name: true, envVariable: true, description: true,
              defaultValue: true, userViewable: true, userEditable: true, rules: true,
            },
          },
        },
      });

      const { userId: _uid, ...serverFields } = server;
      return { ...serverFields, serverVariables: variables };
    }),

  adminGet: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.id),
        columns: {
          id: true, uuid: true, uuidShort: true, name: true, description: true,
          status: true, suspended: true, powerState: true, memory: true, disk: true,
          cpu: true, swap: true, io: true, threads: true, oomDisabled: true,
          image: true, startup: true, invocation: true, skipScripts: true,
          userId: true, nodeId: true, allocationId: true,
        },
        with: {
          allocation: { columns: { id: true, ip: true, port: true } },
          node: { columns: { id: true, name: true, fqdn: true, daemonSFTP: true } },
          egg: {
            columns: { id: true, uuid: true, name: true, startup: true, dockerImages: true },
            with: {
              variables: {
                columns: {
                  id: true, name: true, envVariable: true, description: true,
                  defaultValue: true, userViewable: true, userEditable: true, rules: true,
                },
              },
            },
          },
        },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const variables = await db.query.serverVariables.findMany({
        where: eq(serverVariables.serverId, server.id),
        columns: { variableId: true, variableValue: true },
        with: {
          variable: {
            columns: {
              id: true, name: true, envVariable: true, description: true,
              defaultValue: true, userViewable: true, userEditable: true, rules: true,
            },
          },
        },
      });

      return { ...server, serverVariables: variables };
    }),

  power: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        action: z.enum(["start", "stop", "restart", "kill"]),
      }),
    )
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(
            eq(subusers.userId, userId),
            eq(subusers.serverId, server.id),
          ),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      if (server.suspended) {
        throw new ORPCError("FORBIDDEN", { message: "Server is suspended" });
      }

      const client = createWingsClient(server.node as typeof nodes.$inferSelect);
      await client.sendPowerAction(server.uuid, input.action);
    }),

  reinstall: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const isAdmin = context.session.user.role === "admin";
      if (!isAdmin && server.userId !== context.session.user.id) {
        throw new ORPCError("FORBIDDEN");
      }

      const previousStatus = server.status;

      await db
        .update(servers)
        .set({ status: "installing" })
        .where(eq(servers.id, server.id));

      try {
        const client = createWingsClient(server.node as typeof nodes.$inferSelect);
        await client.reinstallServer(server.uuid);
      } catch (e) {
        await db
          .update(servers)
          .set({ status: previousStatus })
          .where(eq(servers.id, server.id));
        throw e;
      }
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        userId: z.string().min(1),
        nodeId: z.string().uuid(),
        eggId: z.string().uuid(),
        allocationId: z.string().uuid(),
        memory: z.number().int().min(1),
        disk: z.number().int().min(1),
        cpu: z.number().int().min(0),
        swap: z.number().int().default(0),
        io: z.number().int().min(10).max(1000).default(500),
        threads: z.string().optional(),
        oomDisabled: z.boolean().default(false),
        image: z.string().min(1),
        startOnCompletion: z.boolean().default(true),
        skipScripts: z.boolean().default(false),
        variableValues: z.record(z.string(), z.string()).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const allocation = await db.query.nodeAllocations.findFirst({
        where: eq(nodeAllocations.id, input.allocationId),
      });
      if (!allocation) throw new ORPCError("NOT_FOUND", { message: "Allocation not found" });
      if (allocation.serverId) {
        throw new ORPCError("BAD_REQUEST", { message: "Allocation is already assigned" });
      }

      const egg = await db.query.eggs.findFirst({
        where: eq(eggs.id, input.eggId),
        with: { variables: true },
      });
      if (!egg) throw new ORPCError("NOT_FOUND", { message: "Egg not found" });

      const node = await db.query.nodes.findFirst({
        where: eq(nodes.id, input.nodeId),
      });
      if (!node) throw new ORPCError("NOT_FOUND", { message: "Node not found" });

      const varMap: Record<string, string> = {};
      for (const v of egg.variables) {
        varMap[v.envVariable] =
          input.variableValues?.[v.envVariable] ?? v.defaultValue ?? "";
      }

      const invocation = buildInvocation(egg.startup, varMap);
      const id = randomUUID();
      const uuid = randomUUID();
      const uuidShort = uuid.slice(0, 8);

      await db.insert(servers).values({
        id,
        uuid,
        uuidShort,
        name: input.name,
        description: input.description ?? null,
        userId: input.userId,
        nodeId: input.nodeId,
        eggId: input.eggId,
        allocationId: input.allocationId,
        memory: input.memory,
        disk: input.disk,
        cpu: input.cpu,
        swap: input.swap,
        io: input.io,
        threads: input.threads ?? null,
        oomDisabled: input.oomDisabled,
        image: input.image,
        startup: egg.startup,
        skipScripts: input.skipScripts,
        invocation,
        status: "installing",
      });

      if (egg.variables.length > 0) {
        await db.insert(serverVariables).values(
          egg.variables.map((v) => ({
            id: randomUUID(),
            serverId: id,
            variableId: v.id,
            variableValue: resolveVar(input.variableValues, v.envVariable, v.defaultValue),
          })),
        );
      }

      await db
        .update(nodeAllocations)
        .set({ serverId: id })
        .where(eq(nodeAllocations.id, input.allocationId));

      const environment: Record<string, string> = {};
      for (const v of egg.variables) {
        environment[v.envVariable] = resolveVar(
          input.variableValues,
          v.envVariable,
          v.defaultValue,
        );
      }

      const client = createWingsClient(node);
      try {
        await client.createServer({
          uuid,
          start_on_completion: input.startOnCompletion,
          environment,
          limits: {
            cpu: input.cpu,
            memory: input.memory,
            disk: input.disk,
            swap: input.swap,
            io: input.io,
            threads: input.threads ?? null,
            oom_disabled: input.oomDisabled,
          },
          container: {
            image: input.image,
            oom_killer: !input.oomDisabled,
          },
        });
      } catch (err) {
        // Roll back DB changes so the allocation isn't left orphaned
        await db.delete(servers).where(eq(servers.id, id));
        await db
          .update(nodeAllocations)
          .set({ serverId: null })
          .where(eq(nodeAllocations.id, input.allocationId));
        throw err;
      }

      return db.query.servers.findFirst({ where: eq(servers.id, id) });
    }),

  delete: adminProcedure
    .input(
      z.object({
        id: z.string(),
        purgeData: z.boolean().default(false),
      }),
    )
    .handler(async ({ input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.id),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const client = createWingsClient(server.node as typeof nodes.$inferSelect);
      try {
        await client.deleteServer(server.uuid, { purge: input.purgeData });
      } catch {
        // If Wings returns 404 the server doesn't exist on Wings — proceed with DB cleanup
      }

      await db
        .update(nodeAllocations)
        .set({ serverId: null })
        .where(eq(nodeAllocations.id, server.allocationId));

      await db.delete(servers).where(eq(servers.id, server.id));
    }),

  getWebSocketToken: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        with: { node: true },
      });
      if (!server) throw new ORPCError("NOT_FOUND");

      const userId = context.session.user.id;
      const isAdmin = context.session.user.role === "admin";

      if (!isAdmin && server.userId !== userId) {
        const sub = await db.query.subusers.findFirst({
          where: and(
            eq(subusers.userId, userId),
            eq(subusers.serverId, server.id),
          ),
        });
        if (!sub) throw new ORPCError("FORBIDDEN");
      }

      const permissions =
        isAdmin || server.userId === userId
          ? ["*"]
          : await getSubuserPermissions(userId, server.id);

      const node = server.node as typeof nodes.$inferSelect;
      const token = await signWsToken(
        { user_uuid: userId, server_uuid: server.uuid, permissions },
        node.token,
      );

      const wsScheme = node.scheme === "https" ? "wss" : "ws";
      const socketUrl = `${wsScheme}://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}/ws`;

      return { token, socket: socketUrl };
    }),
};

function resolveVar(
  values: Record<string, string> | undefined,
  key: string,
  defaultValue: string | null | undefined,
): string {
  if (values && key in values) return values[key] as string;
  return defaultValue ?? "";
}

async function getSubuserPermissions(
  userId: string,
  serverId: string,
): Promise<string[]> {
  const record = await db.query.subusers.findFirst({
    where: and(eq(subusers.userId, userId), eq(subusers.serverId, serverId)),
  });
  if (!record) return [];
  try {
    return JSON.parse(record.permissions) as string[];
  } catch {
    return [];
  }
}
