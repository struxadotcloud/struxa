import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { userGoogleDrives } from "@struxa/db";
import { safeDecrypt } from "../lib/crypto";
import {
  getGDriveConnection,
  getOperatorGDriveConfig,
  revokeGoogleToken,
} from "../services/google-drive";
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
    const row = await db.query.userGoogleDrives.findFirst({
      where: eq(userGoogleDrives.userId, context.session.user.id),
    });
    if (row) {
      await revokeGoogleToken(safeDecrypt(row.refreshToken));
    }
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
