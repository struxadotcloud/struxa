import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { db } from "@struxa/db";
import { userGoogleDrives } from "@struxa/db";
import { encrypt } from "@struxa/api/lib/crypto";
import {
  exchangeAuthorizationCode,
  fetchUserInfo,
  getAppUrl,
  getOperatorGDriveConfig,
} from "@struxa/api/services/google-drive";

function clearStateCookie(res: NextResponse) {
  res.cookies.set("gdrive_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const appUrl = await getAppUrl();
  const url = new URL(req.url);

  const fail = (query: string) => {
    const res = NextResponse.redirect(`${appUrl}/account?gdrive=${query}`);
    clearStateCookie(res);
    return res;
  };

  if (url.searchParams.get("error")) return fail("denied");

  const state = url.searchParams.get("state");
  const cookie = req.cookies.get("gdrive_oauth_state")?.value;
  const stateOk =
    !!state &&
    !!cookie &&
    state.length === cookie.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(cookie));
  if (!stateOk) {
    const res = new NextResponse("Invalid OAuth state", { status: 400 });
    clearStateCookie(res);
    return res;
  }

  const code = url.searchParams.get("code");
  if (!code) return fail("error");

  const config = await getOperatorGDriveConfig();
  if (!config) return fail("error");

  try {
    const tokens = await exchangeAuthorizationCode(
      code,
      `${appUrl}/api/account/google-drive/callback`,
    );
    const userInfo = await fetchUserInfo(tokens.accessToken);
    const existing = await db.query.userGoogleDrives.findFirst({
      where: eq(userGoogleDrives.userId, session.user.id),
    });
    if (existing && existing.email !== userInfo.email) {
      return fail("mismatch");
    }
    await db
      .insert(userGoogleDrives)
      .values({
        userId: session.user.id,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        email: userInfo.email,
      })
      .onDuplicateKeyUpdate({
        set: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          email: userInfo.email,
        },
      });
    return fail("connected");
  } catch {
    return fail("error");
  }
}
