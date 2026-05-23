import { and, count, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { user, session, servers, nodeAllocations, nodes } from "@struxa/db";
import { recordActivity } from "../services/activity";
import { adminProcedure, protectedProcedure } from "../index";

export const usersRouter = {
  getSelf: protectedProcedure.handler(async ({ context }) => {
    return db.query.user.findFirst({
      where: eq(user.id, context.session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        twoFactorEnabled: true,
        billingName: true,
        billingAddressLine1: true,
        billingAddressLine2: true,
        billingCity: true,
        billingState: true,
        billingPostalCode: true,
        billingCountry: true,
        vatNumber: true,
        vatCountry: true,
      },
    });
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .handler(async ({ input, context }) => {
      await db.update(user).set({ name: input.name }).where(eq(user.id, context.session.user.id));
    }),

  updateBilling: protectedProcedure
    .input(
      z.object({
        billingName: z.string().max(255).optional(),
        billingAddressLine1: z.string().max(255).optional(),
        billingAddressLine2: z.string().max(255).optional(),
        billingCity: z.string().max(100).optional(),
        billingState: z.string().max(100).optional(),
        billingPostalCode: z.string().max(20).optional(),
        billingCountry: z.string().length(2).optional(),
        vatNumber: z.string().max(50).optional(),
        vatCountry: z.string().length(2).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      await db
        .update(user)
        .set({
          billingName: input.billingName ?? null,
          billingAddressLine1: input.billingAddressLine1 ?? null,
          billingAddressLine2: input.billingAddressLine2 ?? null,
          billingCity: input.billingCity ?? null,
          billingState: input.billingState ?? null,
          billingPostalCode: input.billingPostalCode ?? null,
          billingCountry: input.billingCountry ?? null,
          vatNumber: input.vatNumber ?? null,
          vatCountry: input.vatCountry ?? null,
        })
        .where(eq(user.id, context.session.user.id));
    }),

  listSessions: protectedProcedure.handler(async ({ context }) => {
    return db.query.session.findMany({
      where: eq(session.userId, context.session.user.id),
      columns: {
        id: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
  }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionToken: z.string() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(session)
        .where(
          and(
            eq(session.token, input.sessionToken),
            eq(session.userId, context.session.user.id),
          ),
        );
    }),

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

      const [users, totalResult] = await Promise.all([
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

      return { users, total: totalResult[0]?.total ?? 0, page: input.page, pageSize };
    }),

  adminGet: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input }) => {
      const [userData, serverCountResult] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, input.userId),
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            banned: true,
            banReason: true,
            banExpires: true,
            createdAt: true,
            twoFactorEnabled: true,
            billingName: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingState: true,
            billingPostalCode: true,
            billingCountry: true,
            vatNumber: true,
            vatCountry: true,
          },
        }),
        db.select({ serverCount: count() }).from(servers).where(eq(servers.userId, input.userId)),
      ]);

      if (!userData) return null;
      return { ...userData, serverCount: serverCountResult[0]?.serverCount ?? 0 };
    }),

  adminGetSessions: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input }) => {
      return db.query.session.findMany({
        where: eq(session.userId, input.userId),
        columns: {
          id: true,
          token: true,
          createdAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
        },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });
    }),

  adminGetServers: adminProcedure
    .input(z.object({ userId: z.string(), page: z.number().int().min(1).default(1) }))
    .handler(async ({ input }) => {
      const pageSize = 20;
      const offset = (input.page - 1) * pageSize;

      const [userServers, totalResult] = await Promise.all([
        db
          .select({
            id: servers.id,
            name: servers.name,
            suspended: servers.suspended,
            createdAt: servers.createdAt,
            nodeName: nodes.name,
            allocationIp: nodeAllocations.ip,
            allocationPort: nodeAllocations.port,
          })
          .from(servers)
          .leftJoin(nodes, eq(servers.nodeId, nodes.id))
          .leftJoin(nodeAllocations, eq(servers.allocationId, nodeAllocations.id))
          .where(eq(servers.userId, input.userId))
          .limit(pageSize)
          .offset(offset)
          .orderBy(servers.createdAt),
        db.select({ total: count() }).from(servers).where(eq(servers.userId, input.userId)),
      ]);

      return { servers: userServers, total: totalResult[0]?.total ?? 0, page: input.page, pageSize };
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["user", "admin"]) }))
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new Error("Cannot change your own role.");
      }
      await db.update(user).set({ role: input.role }).where(eq(user.id, input.userId));
      recordActivity({ eventType: "admin:user.set-role", userId: context.session.user.id, ip: context.ip, properties: { targetUserId: input.userId, role: input.role } });
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
      recordActivity({ eventType: "admin:user.ban", userId: context.session.user.id, ip: context.ip, properties: { targetUserId: input.userId, reason: input.reason, expiresAt: input.expiresAt } });
    }),

  unban: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input, context }) => {
      await db
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(user.id, input.userId));
      recordActivity({ eventType: "admin:user.unban", userId: context.session.user.id, ip: context.ip, properties: { targetUserId: input.userId } });
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new Error("Cannot delete your own account.");
      }
      await db.delete(user).where(eq(user.id, input.userId));
      recordActivity({ eventType: "admin:user.delete", userId: context.session.user.id, ip: context.ip, properties: { targetUserId: input.userId } });
    }),
};
