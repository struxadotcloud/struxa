import * as jose from "jose";
import { createHash, randomUUID } from "crypto";
import { env } from "@struxa/env/server";
import { getEffectiveAppUrl } from "../services/instance";

let _privateKey: jose.KeyLike | null = null;
let _publicKey: jose.KeyLike | null = null;

async function getPrivateKey(): Promise<jose.KeyLike> {
  if (!_privateKey) {
    const pem = env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n");
    _privateKey = await jose.importPKCS8(pem, "RS256");
  }
  return _privateKey;
}

async function getPublicKey(): Promise<jose.KeyLike> {
  if (!_publicKey) {
    const pem = env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");
    _publicKey = await jose.importSPKI(pem, "RS256");
  }
  return _publicKey;
}

export interface WsTokenPayload {
  user_uuid: string;
  server_uuid: string;
  permissions: string[];
}

export function toUuid(id: string): string {
  const h = createHash("sha256").update(id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function signWsToken(
  payload: WsTokenPayload,
  nodeToken: string,
): Promise<string> {
  const secret = new TextEncoder().encode(nodeToken);
  const appUrl = await getEffectiveAppUrl();
  return new jose.SignJWT({
    user_uuid: toUuid(payload.user_uuid),
    server_uuid: payload.server_uuid,
    permissions: payload.permissions,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer(appUrl)
    .setAudience(["*"])
    .setJti(randomUUID())
    .sign(secret);
}

export async function signBackupDownloadToken(
  userId: string,
  serverUuid: string,
  backupUuid: string,
  nodeToken: string,
): Promise<string> {
  const secret = new TextEncoder().encode(nodeToken);
  const appUrl = await getEffectiveAppUrl();
  return new jose.SignJWT({
    user_uuid: toUuid(userId),
    server_uuid: serverUuid,
    backup_uuid: backupUuid,
    unique_id: randomUUID(),
    scope: "backup-download",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer(appUrl)
    .setAudience(["*"])
    .setJti(randomUUID())
    .sign(secret);
}

export async function getPublicKeyJwk(): Promise<jose.JWK> {
  const key = await getPublicKey();
  return jose.exportJWK(key);
}

export async function verifyWsToken(
  token: string,
): Promise<jose.JWTPayload & WsTokenPayload> {
  const key = await getPublicKey();
  const { payload } = await jose.jwtVerify(token, key, { algorithms: ["RS256"] });
  return payload as jose.JWTPayload & WsTokenPayload;
}
