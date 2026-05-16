import { and, eq, like } from "drizzle-orm";
import { compare } from "bcryptjs";
import { db } from "@struxa/db";
import { account, servers, subusers, user } from "@struxa/db";
import { toUuid } from "../lib/jwt";

export interface SftpAuthResult {
  user: string;
  server: string;
  permissions: string[];
  ignored_files: string[];
}

export async function authenticateSftp(
  username: string,
  password: string,
): Promise<SftpAuthResult | null> {
  const parts = username.split(".");
  if (parts.length < 2) {
    console.log("[sftp] bad format:", username);
    return null;
  }
  const uuidShort = parts[parts.length - 1]!;
  const emailPrefix = parts.slice(0, -1).join(".");
  console.log("[sftp] uuidShort=%s emailPrefix=%s", uuidShort, emailPrefix);

  const server = await db.query.servers.findFirst({
    where: eq(servers.uuidShort, uuidShort),
  });
  if (!server) { console.log("[sftp] server not found for uuidShort:", uuidShort); return null; }
  if (server.suspended) { console.log("[sftp] server suspended"); return null; }

  const userRecord = await db.query.user.findFirst({
    where: like(user.email, `${emailPrefix}@%`),
  });
  if (!userRecord) {
    console.log("[sftp] no user with email prefix:", emailPrefix);
    return null;
  }
  console.log("[sftp] found user:", userRecord.email);

  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, userRecord.id), eq(account.providerId, "credential")),
  });
  if (!credential?.password) {
    console.log("[sftp] no credential for user:", userRecord.id);
    return null;
  }

  const valid = await compare(password, credential.password);
  if (!valid) {
    console.log("[sftp] wrong password for user:", userRecord.email);
    return null;
  }

  const isOwner = server.userId === userRecord.id;
  let permissions: string[];

  if (isOwner) {
    permissions = ["*"];
  } else {
    const subuserRecord = await db.query.subusers.findFirst({
      where: and(eq(subusers.userId, userRecord.id), eq(subusers.serverId, server.id)),
    });
    if (!subuserRecord) {
      console.log("[sftp] not owner and not subuser");
      return null;
    }
    permissions = JSON.parse(subuserRecord.permissions) as string[];
    const hasSftpAccess = permissions.some(
      (p) => p === "*" || p.startsWith("file.") || p === "file",
    );
    if (!hasSftpAccess) {
      console.log("[sftp] subuser has no file permission");
      return null;
    }
  }

  console.log("[sftp] auth ok, permissions:", permissions);
  return { user: toUuid(userRecord.id), server: server.uuid, permissions, ignored_files: [] };
}
