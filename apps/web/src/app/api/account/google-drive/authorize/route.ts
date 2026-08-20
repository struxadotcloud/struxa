import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { getAppUrl, getOperatorGDriveConfig } from "@struxa/api/services/google-drive";

export async function GET(req: NextRequest) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const config = await getOperatorGDriveConfig();
  if (!config) return new Response("Google Drive is not configured", { status: 400 });

  const appUrl = await getAppUrl();
  if (!appUrl) return new Response("APP_URL is not configured", { status: 400 });

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/account/google-drive/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  res.cookies.set("gdrive_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
