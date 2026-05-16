import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { locations } from "@struxa/db";
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
    .handler(async ({ input }) => {
      const id = randomUUID();
      await db.insert(locations).values({ id, ...input });
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
    .handler(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(locations).set(data).where(eq(locations.id, id));
      return db.query.locations.findFirst({ where: eq(locations.id, id) });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(locations).where(eq(locations.id, input.id));
    }),
};
