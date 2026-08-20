import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { settings, userGoogleDrives } from "@struxa/db";
import { env } from "@struxa/env/server";
import { encrypt, safeDecrypt } from "../lib/crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export interface GDriveOperatorConfig {
  clientId: string;
  clientSecret: string;
}

export interface GDriveConnection {
  accessToken: string;
  refreshToken: string;
  email: string;
}

async function readSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export async function getOperatorGDriveConfig(): Promise<GDriveOperatorConfig | null> {
  const s = await readSettingsMap();
  if (!s.google_drive_client_id || !s.google_drive_client_secret) return null;
  return {
    clientId: s.google_drive_client_id,
    clientSecret: safeDecrypt(s.google_drive_client_secret),
  };
}

export async function getAppUrl(): Promise<string> {
  const s = await readSettingsMap();
  return env.APP_URL ?? s.app_url ?? "";
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Google token request failed with status ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  config: GDriveOperatorConfig,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const data = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const config = await getOperatorGDriveConfig();
  if (!config) throw new Error("Google Drive is not configured");
  const data = await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!data.refresh_token) throw new Error("No refresh token in Google response");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function fetchUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo request failed with status ${res.status}`);
  return (await res.json()) as { email: string };
}

const connectionLoads = new Map<string, Promise<GDriveConnection | null>>();

export function getGDriveConnection(
  userId: string,
): Promise<GDriveConnection | null> {
  const existing = connectionLoads.get(userId);
  if (existing) return existing;
  const promise = loadGDriveConnection(userId).finally(() => {
    connectionLoads.delete(userId);
  });
  connectionLoads.set(userId, promise);
  return promise;
}

async function loadGDriveConnection(
  userId: string,
): Promise<GDriveConnection | null> {
  const row = await db.query.userGoogleDrives.findFirst({
    where: eq(userGoogleDrives.userId, userId),
  });
  if (!row) return null;
  const config = await getOperatorGDriveConfig();
  if (!config) return null;

  const accessToken = safeDecrypt(row.accessToken);
  const refreshToken = safeDecrypt(row.refreshToken);

  if (row.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return { accessToken, refreshToken, email: row.email };
  }

  try {
    const refreshed = await refreshAccessToken(config, refreshToken);
    await db
      .update(userGoogleDrives)
      .set({
        accessToken: encrypt(refreshed.accessToken),
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      })
      .where(eq(userGoogleDrives.userId, userId));
    return { accessToken: refreshed.accessToken, refreshToken, email: row.email };
  } catch {
    return null;
  }
}

async function driveRequest(
  config: GDriveOperatorConfig,
  connection: GDriveConnection,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const send = (token: string) =>
    fetch(`${DRIVE_API}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

  const res = await send(connection.accessToken);
  if (res.status !== 401) return res;
  const refreshed = await refreshAccessToken(config, connection.refreshToken);
  return send(refreshed.accessToken);
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(
  config: GDriveOperatorConfig,
  connection: GDriveConnection,
  name: string,
  parentId?: string,
): Promise<string> {
  const q = `name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${
    parentId ? ` and '${parentId}' in parents` : ""
  }`;
  const listRes = await driveRequest(
    config,
    connection,
    `?q=${encodeURIComponent(q)}&fields=files(id)`,
  );
  if (listRes.ok) {
    const data = (await listRes.json()) as { files?: { id: string }[] };
    if (data.files?.[0]?.id) return data.files[0].id;
  }

  const createRes = await driveRequest(config, connection, "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder, status ${createRes.status}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

const folderResolves = new Map<string, Promise<string>>();

export function ensureGDriveFolders(
  connection: GDriveConnection,
  serverName: string,
  serverUuid: string,
): Promise<string> {
  const key = `${serverUuid}:${serverName}`;
  const existing = folderResolves.get(key);
  if (existing) return existing;
  const promise = resolveGDriveFolders(connection, serverName, serverUuid).finally(
    () => {
      folderResolves.delete(key);
    },
  );
  folderResolves.set(key, promise);
  return promise;
}

async function resolveGDriveFolders(
  connection: GDriveConnection,
  serverName: string,
  serverUuid: string,
): Promise<string> {
  const config = await getOperatorGDriveConfig();
  if (!config) throw new Error("Google Drive is not configured");
  const parentId = await findOrCreateFolder(config, connection, "Struxa Backups");
  return findOrCreateFolder(
    config,
    connection,
    `${serverName} (${serverUuid.slice(0, 8)})`,
    parentId,
  );
}

export async function downloadDriveFile(
  connection: GDriveConnection,
  fileId: string,
): Promise<Response> {
  const config = await getOperatorGDriveConfig();
  if (!config) throw new Error("Google Drive is not configured");
  return driveRequest(config, connection, `/${fileId}?alt=media`);
}

export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
    { method: "POST" },
  ).catch(() => {});
}
