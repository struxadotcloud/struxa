import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import { Cron } from "croner";
import { db } from "@struxa/db";
import { schedules, scheduleTasks, servers } from "@struxa/db";
import { nodes } from "@struxa/db";
import { createWingsClient } from "@struxa/api/lib/wings-client";

const POLL_MS = 15_000;

export async function runScheduleWorker() {
  console.log("[schedules] worker started, polling every 15s");
  await tick();
  setInterval(() => void tick(), POLL_MS);
}

async function tick() {
  try {
    const due = await db.query.schedules.findMany({
      where: and(
        eq(schedules.isActive, true),
        eq(schedules.isProcessing, false),
        isNotNull(schedules.nextRunAt),
        lte(schedules.nextRunAt, new Date()),
      ),
      with: {
        tasks: { orderBy: asc(scheduleTasks.sequenceId) },
        server: { with: { node: true } },
      },
    });

    await Promise.allSettled(due.map((schedule) => runSchedule(schedule)));
  } catch (err) {
    console.error("[schedules] tick error:", err);
  }
}

type Task = { id: string; action: string; payload: string; timeOffset: number; continueOnFailure: boolean };
type ServerWithNode = typeof servers.$inferSelect & { node: typeof nodes.$inferSelect };
type DueSchedule = typeof schedules.$inferSelect & { tasks: Task[]; server: ServerWithNode | null };

async function runSchedule(schedule: DueSchedule) {
  const server = schedule.server;
  if (!server) return;

  await db
    .update(schedules)
    .set({ isProcessing: true })
    .where(eq(schedules.id, schedule.id));

  console.log(`[schedules] running schedule "${schedule.name}" for server ${server.uuid}`);

  const client = createWingsClient(server.node);

  try {
    for (const task of schedule.tasks) {
      if (task.timeOffset > 0) {
        await sleep(task.timeOffset * 1000);
      }

      try {
        await executeTask(client, server.uuid, task.action, task.payload);
      } catch (err) {
        console.error(`[schedules] task ${task.id} (${task.action}) failed:`, err);
        if (!task.continueOnFailure) break;
      }
    }
  } finally {
    const nextRunAt = computeNextRun(schedule);
    await db
      .update(schedules)
      .set({ isProcessing: false, lastRunAt: new Date(), nextRunAt })
      .where(eq(schedules.id, schedule.id));
  }
}

async function executeTask(
  client: ReturnType<typeof createWingsClient>,
  serverUuid: string,
  action: string,
  payload: string,
) {
  switch (action) {
    case "power":
      await client.sendPowerAction(
        serverUuid,
        payload as "start" | "stop" | "restart" | "kill",
      );
      break;
    case "command":
      await client.sendCommands(serverUuid, [payload]);
      break;
    case "backup":
      await client.createBackup(serverUuid, {
        uuid: crypto.randomUUID(),
        ignore: "",
        adapter: "wings",
      });
      break;
    default:
      console.warn(`[schedules] unknown task action: ${action}`);
  }
}

function computeNextRun(schedule: {
  cronSecond: string;
  cronMinute: string;
  cronHour: string;
  cronDayOfWeek: string;
  cronDayOfMonth: string;
}): Date | null {
  try {
    // Build croner 6-field expression: second minute hour dayOfMonth month dayOfWeek
    const expr = `${schedule.cronSecond} ${schedule.cronMinute} ${schedule.cronHour} ${schedule.cronDayOfMonth} * ${schedule.cronDayOfWeek}`;
    const job = new Cron(expr);
    return job.nextRun() ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
