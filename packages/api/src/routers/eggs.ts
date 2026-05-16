import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { eggVariables, eggs } from "@struxa/db";
import { adminProcedure, protectedProcedure } from "../index";

const EggVariableSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  envVariable: z.string().min(1).max(255),
  defaultValue: z.string().optional(),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(true),
  rules: z.string().optional(),
});

export const eggsRouter = {
  listByNest: protectedProcedure
    .input(z.object({ nestId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.eggs.findMany({
        where: eq(eggs.nestId, input.nestId),
        with: { variables: true },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.eggs.findFirst({
        where: eq(eggs.id, input.id),
        with: { variables: true },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        nestId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        dockerImages: z.record(z.string(), z.string()).default({}),
        startup: z.string().min(1),
        stopCommand: z.string().optional(),
        features: z.array(z.string()).optional(),
        configFiles: z.string().optional(),
        configStartup: z.string().optional(),
        configStop: z.string().optional(),
        configLogs: z.string().optional(),
        scriptInstall: z.string().optional(),
        scriptEntry: z.string().optional(),
        scriptContainer: z.string().optional(),
        scriptExtension: z.string().optional(),
        variables: z.array(EggVariableSchema).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { variables, dockerImages, features, ...eggData } = input;
      const id = randomUUID();
      const uuid = randomUUID();

      await db.insert(eggs).values({
        id,
        uuid,
        dockerImages: JSON.stringify(dockerImages),
        features: features ? JSON.stringify(features) : null,
        ...eggData,
      });

      if (variables?.length) {
        await db.insert(eggVariables).values(
          variables.map((v) => ({ id: randomUUID(), eggId: id, ...v })),
        );
      }

      return db.query.eggs.findFirst({
        where: eq(eggs.id, id),
        with: { variables: true },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        dockerImages: z.record(z.string(), z.string()).optional(),
        startup: z.string().min(1).optional(),
        stopCommand: z.string().optional(),
        scriptInstall: z.string().optional(),
        scriptEntry: z.string().optional(),
        scriptContainer: z.string().optional(),
        scriptExtension: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, dockerImages, ...data } = input;
      await db
        .update(eggs)
        .set({
          ...data,
          ...(dockerImages ? { dockerImages: JSON.stringify(dockerImages) } : {}),
        })
        .where(eq(eggs.id, id));
      return db.query.eggs.findFirst({
        where: eq(eggs.id, id),
        with: { variables: true },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(eggs).where(eq(eggs.id, input.id));
    }),

  addVariable: adminProcedure
    .input(
      z.object({
        eggId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        envVariable: z.string().min(1).max(255),
        defaultValue: z.string().optional(),
        userViewable: z.boolean().default(true),
        userEditable: z.boolean().default(true),
        rules: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { eggId, ...variableData } = input;
      const id = randomUUID();
      await db.insert(eggVariables).values({ id, eggId, ...variableData });
      return db.query.eggVariables.findFirst({ where: eq(eggVariables.id, id) });
    }),

  updateVariable: adminProcedure
    .input(
      z.object({
        variableId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        envVariable: z.string().min(1).max(255).optional(),
        defaultValue: z.string().optional(),
        userViewable: z.boolean().optional(),
        userEditable: z.boolean().optional(),
        rules: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { variableId, name, description, envVariable, defaultValue, userViewable, userEditable, rules } = input;
      const updates: {
        name?: string;
        description?: string;
        envVariable?: string;
        defaultValue?: string;
        userViewable?: boolean;
        userEditable?: boolean;
        rules?: string;
      } = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (envVariable !== undefined) updates.envVariable = envVariable;
      if (defaultValue !== undefined) updates.defaultValue = defaultValue;
      if (userViewable !== undefined) updates.userViewable = userViewable;
      if (userEditable !== undefined) updates.userEditable = userEditable;
      if (rules !== undefined) updates.rules = rules;
      if (Object.keys(updates).length > 0) {
        await db.update(eggVariables).set(updates).where(eq(eggVariables.id, variableId));
      }
      return db.query.eggVariables.findFirst({ where: eq(eggVariables.id, variableId) });
    }),

  deleteVariable: adminProcedure
    .input(z.object({ variableId: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(eggVariables).where(eq(eggVariables.id, input.variableId));
    }),

  importJson: adminProcedure
    .input(z.object({ nestId: z.string().uuid(), json: z.string() }))
    .handler(async ({ input }) => {
      const raw = JSON.parse(input.json) as {
        name: string;
        description?: string;
        startup?: string;
        config?: {
          files?: string;
          startup?: string;
          stop?: string;
          logs?: string;
        };
        scripts?: {
          installation?: {
            script?: string;
            container?: string;
            entrypoint?: string;
          };
        };
        variables?: Array<{
          name: string;
          description?: string;
          env_variable: string;
          default_value?: string;
          user_viewable?: boolean;
          user_editable?: boolean;
          rules?: string;
        }>;
        docker_images?: Record<string, string>;
      };

      const id = randomUUID();
      const uuid = randomUUID();

      await db.insert(eggs).values({
        id,
        uuid,
        nestId: input.nestId,
        name: raw.name,
        description: raw.description ?? null,
        startup: raw.startup ?? "",
        dockerImages: JSON.stringify(raw.docker_images ?? {}),
        configFiles: raw.config?.files ?? null,
        configStartup: raw.config?.startup ?? null,
        configStop: raw.config?.stop ?? null,
        configLogs: raw.config?.logs ?? null,
        scriptInstall: raw.scripts?.installation?.script ?? null,
        scriptContainer: raw.scripts?.installation?.container ?? null,
        scriptEntry: raw.scripts?.installation?.entrypoint ?? "bash",
      });

      if (raw.variables?.length) {
        await db.insert(eggVariables).values(
          raw.variables.map((v) => ({
            id: randomUUID(),
            eggId: id,
            name: v.name,
            description: v.description ?? null,
            envVariable: v.env_variable,
            defaultValue: v.default_value ?? null,
            userViewable: v.user_viewable ?? true,
            userEditable: v.user_editable ?? true,
            rules: v.rules ?? null,
          })),
        );
      }

      return db.query.eggs.findFirst({
        where: eq(eggs.id, id),
        with: { variables: true },
      });
    }),
};
