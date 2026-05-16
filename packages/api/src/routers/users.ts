import { or, like } from "drizzle-orm";
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
};
