import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { userGoogleDrives } from "@struxa/db";
import { getGDriveConnection, getOperatorGDriveConfig } from "../services/google-drive";
import { recordActivity } from "../services/activity";
import { protectedProcedure } from "../index";

export const googleDriveRouter = {
  get: protectedProcedure.handler(async ({ context }) => {
    const [config, connection] = await Promise.all([
      getOperatorGDriveConfig(),
      getGDriveConnection(context.session.user.id),
    ]);
    return {
      operatorConfigured: !!config,
      connected: !!connection,
      email: connection?.email ?? null,
    };
  }),

  disconnect: protectedProcedure.handler(async ({ context }) => {
    await db
      .delete(userGoogleDrives)
      .where(eq(userGoogleDrives.userId, context.session.user.id));
    recordActivity({
      eventType: "account:google-drive.disconnect",
      userId: context.session.user.id,
      ip: context.ip,
    });
    return { ok: true };
  }),
};
