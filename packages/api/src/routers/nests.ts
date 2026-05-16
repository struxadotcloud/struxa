import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { nests } from "@struxa/db";
import { adminProcedure, protectedProcedure } from "../index";

export const nestsRouter = {
  list: protectedProcedure.handler(async () => {
    return db.select().from(nests);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.nests.findFirst({
        where: eq(nests.id, input.id),
        with: { eggs: true },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        author: z.string().min(1).max(255),
      }),
    )
    .handler(async ({ input }) => {
      const id = randomUUID();
      const uuid = randomUUID();
      await db.insert(nests).values({ id, uuid, ...input });
      return db.query.nests.findFirst({ where: eq(nests.id, id) });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        author: z.string().min(1).max(255).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(nests).set(data).where(eq(nests.id, id));
      return db.query.nests.findFirst({ where: eq(nests.id, id) });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(nests).where(eq(nests.id, input.id));
    }),
};
