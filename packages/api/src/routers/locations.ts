import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { locations } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { adminProcedure, protectedProcedure } from "../index";

export const locationsRouter = {
  list: protectedProcedure.handler(async () => {
    return db.select().from(locations);
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        short: z.string().min(1).max(60),
        long: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      await db.insert(locations).values({ id, ...input });
      recordActivity({ eventType: "admin:location.create", userId: context.session.user.id, ip: context.ip, properties: { short: input.short, long: input.long } });
      return db.query.locations.findFirst({ where: eq(locations.id, id) });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        short: z.string().min(1).max(60).optional(),
        long: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      await db.update(locations).set(data).where(eq(locations.id, id));
      const location = await db.query.locations.findFirst({ where: eq(locations.id, id) });
      recordActivity({ eventType: "admin:location.update", userId: context.session.user.id, ip: context.ip, properties: { short: location?.short } });
      return location;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const location = await db.query.locations.findFirst({ where: eq(locations.id, input.id) });
      await db.delete(locations).where(eq(locations.id, input.id));
      recordActivity({ eventType: "admin:location.delete", userId: context.session.user.id, ip: context.ip, properties: { short: location?.short } });
    }),
};
