import { count, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { user } from "@struxa/db";
import { adminProcedure } from "../index";

export const usersRouter = {
  search: adminProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .handler(async ({ input }) => {
      const q = `%${input.query}%`;
      return db.query.user.findMany({
        where: or(like(user.name, q), like(user.email, q)),
        columns: { id: true, name: true, email: true },
        limit: 10,
      });
    }),

  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        search: z.string().max(100).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const pageSize = 20;
      const offset = (input.page - 1) * pageSize;

      const whereClause = input.search
        ? or(like(user.name, `%${input.search}%`), like(user.email, `%${input.search}%`))
        : undefined;

      const [users, [{ total }]] = await Promise.all([
        db.query.user.findMany({
          where: whereClause,
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
            banned: true,
            banReason: true,
            banExpires: true,
            createdAt: true,
          },
          limit: pageSize,
          offset,
          orderBy: (u, { desc }) => [desc(u.createdAt)],
        }),
        db.select({ total: count() }).from(user).where(whereClause),
      ]);

      return { users, total, page: input.page, pageSize };
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["user", "admin"]) }))
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new Error("Cannot change your own role.");
      }
      await db.update(user).set({ role: input.role }).where(eq(user.id, input.userId));
    }),

  ban: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.string().max(500).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new Error("Cannot ban yourself.");
      }
      await db
        .update(user)
        .set({
          banned: true,
          banReason: input.reason ?? null,
          banExpires: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .where(eq(user.id, input.userId));
    }),

  unban: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input }) => {
      await db
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, input.userId));
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new Error("Cannot delete your own account.");
      }
      await db.delete(user).where(eq(user.id, input.userId));
    }),
};
