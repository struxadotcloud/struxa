import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { scheduleTasks, schedules, servers, subusers } from "@struxa/db";
import { computeNextRun } from "../services/schedules";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

async function requireServerAccess(userId: string, serverId: string, role: string | null | undefined) {
  const server = await db.query.servers.findFirst({ where: eq(servers.id, serverId) });
  if (!server) throw new ORPCError("NOT_FOUND");
  if (role !== "admin" && server.userId !== userId) {
    const sub = await db.query.subusers.findFirst({
      where: and(eq(subusers.userId, userId), eq(subusers.serverId, serverId)),
    });
    if (!sub) throw new ORPCError("FORBIDDEN");
  }
  return server;
}

const CronScheduleSchema = z.object({
  cronSecond: z.string().default("0"),
  cronMinute: z.string(),
  cronHour: z.string(),
  cronDayOfWeek: z.string(),
  cronDayOfMonth: z.string(),
});

export const schedulesRouter = {
  list: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);
      return db.query.schedules.findMany({
        where: eq(schedules.serverId, input.serverId),
        with: { tasks: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        name: z.string().min(1).max(255),
        isActive: z.boolean().default(true),
        ...CronScheduleSchema.shape,
      }),
    )
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);

      const nextRunAt = computeNextRun(
        input.cronSecond,
        input.cronMinute,
        input.cronHour,
        input.cronDayOfMonth,
        input.cronDayOfWeek,
      );

      const id = randomUUID();
      await db.insert(schedules).values({ id, ...input, nextRunAt });

      recordActivity({
        eventType: "server:schedule.create",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: input.name },
      });

      return db.query.schedules.findFirst({ where: eq(schedules.id, id), with: { tasks: true } });
    }),

  update: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        scheduleId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
        cronSecond: z.string().optional(),
        cronMinute: z.string().optional(),
        cronHour: z.string().optional(),
        cronDayOfWeek: z.string().optional(),
        cronDayOfMonth: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);

      const schedule = await db.query.schedules.findFirst({
        where: and(eq(schedules.id, input.scheduleId), eq(schedules.serverId, input.serverId)),
      });
      if (!schedule) throw new ORPCError("NOT_FOUND");

      const { serverId, scheduleId, ...data } = input;
      const merged = { ...schedule, ...data };
      const nextRunAt = computeNextRun(
        merged.cronSecond,
        merged.cronMinute,
        merged.cronHour,
        merged.cronDayOfMonth,
        merged.cronDayOfWeek,
      );

      await db.update(schedules).set({ ...data, nextRunAt }).where(eq(schedules.id, scheduleId));

      recordActivity({
        eventType: "server:schedule.update",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: merged.name },
      });

      return db.query.schedules.findFirst({ where: eq(schedules.id, scheduleId), with: { tasks: true } });
    }),

  delete: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), scheduleId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);

      const schedule = await db.query.schedules.findFirst({
        where: and(eq(schedules.id, input.scheduleId), eq(schedules.serverId, input.serverId)),
      });

      await db.delete(schedules).where(
        and(eq(schedules.id, input.scheduleId), eq(schedules.serverId, input.serverId)),
      );

      recordActivity({
        eventType: "server:schedule.delete",
        userId: context.session.user.id,
        serverId: input.serverId,
        ip: context.ip,
        properties: { name: schedule?.name },
      });
    }),

  createTask: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        scheduleId: z.string().uuid(),
        sequenceId: z.number().int().min(1),
        action: z.enum(["command", "power", "backup"]),
        payload: z.string(),
        timeOffset: z.number().int().min(0).default(0),
        continueOnFailure: z.boolean().default(false),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);
      const id = randomUUID();
      const { serverId, ...taskData } = input;
      await db.insert(scheduleTasks).values({ id, ...taskData });
      const task = await db.query.scheduleTasks.findFirst({ where: eq(scheduleTasks.id, id) });
      if (!task) throw new Error("Failed to create task");
      return task;
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        taskId: z.string().uuid(),
        sequenceId: z.number().int().min(1).optional(),
        action: z.enum(["command", "power", "backup"]).optional(),
        payload: z.string().optional(),
        timeOffset: z.number().int().min(0).optional(),
        continueOnFailure: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);
      const { serverId, taskId, ...data } = input;
      await db.update(scheduleTasks).set(data).where(eq(scheduleTasks.id, taskId));
      return db.query.scheduleTasks.findFirst({ where: eq(scheduleTasks.id, taskId) });
    }),

  deleteTask: protectedProcedure
    .input(z.object({ serverId: z.string().uuid(), taskId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await requireServerAccess(context.session.user.id, input.serverId, context.session.user.role);
      await db.delete(scheduleTasks).where(eq(scheduleTasks.id, input.taskId));
    }),
};
