import { eq } from "drizzle-orm";
import { Cron } from "croner";
import { db } from "@struxa/db";
import { schedules } from "@struxa/db";

export function computeNextRun(
  cronSecond: string,
  cronMinute: string,
  cronHour: string,
  cronDayOfMonth: string,
  cronDayOfWeek: string,
): Date | null {
  try {
    const expr = `${cronSecond} ${cronMinute} ${cronHour} ${cronDayOfMonth} * ${cronDayOfWeek}`;
    const cron = new Cron(expr);
    return cron.nextRun() ?? null;
  } catch {
    return null;
  }
}

export async function completeSchedule(scheduleId: string): Promise<void> {
  const schedule = await db.query.schedules.findFirst({
    where: eq(schedules.id, scheduleId),
  });
  if (!schedule) return;

  const nextRunAt = computeNextRun(
    schedule.cronSecond,
    schedule.cronMinute,
    schedule.cronHour,
    schedule.cronDayOfMonth,
    schedule.cronDayOfWeek,
  );

  await db
    .update(schedules)
    .set({
      isProcessing: false,
      lastRunAt: new Date(),
      nextRunAt: nextRunAt ?? undefined,
    })
    .where(eq(schedules.id, scheduleId));
}
