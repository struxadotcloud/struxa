import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { settings } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { adminProcedure, publicProcedure } from "../index";

export const settingsRouter = {
  isSetupComplete: publicProcedure.handler(async () => {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "setup_complete"),
    });
    return row?.value === "true";
  }),

  get: adminProcedure
    .input(z.object({ key: z.string().max(255) }))
    .handler(async ({ input }) => {
      const row = await db.query.settings.findFirst({
        where: eq(settings.key, input.key),
      });
      return row?.value ?? null;
    }),

  set: adminProcedure
    .input(z.object({ key: z.string().max(255), value: z.string() }))
    .handler(async ({ context, input }) => {
      await db
        .insert(settings)
        .values({ key: input.key, value: input.value, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { value: input.value, updatedAt: new Date() } });
      recordActivity({ eventType: "admin:settings.update", userId: context.session.user.id, ip: context.ip, properties: { key: input.key } });
    }),

  getAll: adminProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  }),
};
