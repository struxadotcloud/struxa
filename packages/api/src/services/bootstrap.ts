import { randomBytes, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { account, db, locations, nodes, settings, user } from "@struxa/db";
import { getAuth, hashPassword } from "@struxa/auth";
import { env } from "@struxa/env/server";
import { encrypt } from "../lib/crypto";
import { buildWingsConfigYaml } from "../lib/wings-config";
import { getEffectiveAppUrl } from "./instance";
import { recordActivity } from "./activity";

export class BootstrapError extends Error {
  constructor(
    public code: "setup_complete" | "users_exist",
    message: string,
  ) {
    super(message);
  }
}

type BootstrapInput = {
  email: string;
  password: string;
  name?: string;
  locationName?: string;
  wings?: {
    fqdn: string;
    nodeName?: string;
    scheme?: "https" | "http";
    daemonListen?: number;
    memory?: number;
    disk?: number;
    uploadSize?: number;
  };
};

export async function bootstrapInstaller(input: BootstrapInput) {
  const setupRow = await db.query.settings.findFirst({
    where: eq(settings.key, "setup_complete"),
  });
  if (setupRow?.value === "true") {
    throw new BootstrapError("setup_complete", "Setup is already complete.");
  }

  const [existingUser] = await db.select().from(user).limit(1);
  if (existingUser) {
    throw new BootstrapError("users_exist", "A user already exists.");
  }

  const adminName = input.name ?? input.email.split("@")[0] ?? input.email;

  let adminId: string;
  if (env.TURNSTILE_SECRET_KEY) {
    adminId = randomUUID();
    const hash = await hashPassword(input.password);
    await db.insert(user).values({
      id: adminId,
      name: adminName,
      email: input.email,
      emailVerified: true,
      role: "admin",
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: adminId,
      providerId: "credential",
      password: hash,
      userId: adminId,
    });
  } else {
    const auth = await getAuth();
    const created = await auth.api.signUpEmail({
      body: { name: adminName, email: input.email, password: input.password },
    });
    adminId = created.user.id;
  }

  await db.update(user).set({ role: "admin" }).where(eq(user.id, adminId));

  const locationId = randomUUID();
  await db.insert(locations).values({
    id: locationId,
    name: input.locationName ?? "Default",
    short: "DEFAULT",
  });

  let wings: { nodeId: string; configYaml: string } | undefined;
  if (input.wings) {
    const id = randomUUID();
    const uuid = randomUUID();
    const tokenId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const fqdn = input.wings.fqdn;
    const scheme = input.wings.scheme ?? "https";
    const memory = input.wings.memory ?? 4096;
    const disk = input.wings.disk ?? 50000;
    const uploadSize = input.wings.uploadSize ?? 100;
    const daemonListen = input.wings.daemonListen ?? 443;

    await db.insert(nodes).values({
      id,
      uuid,
      tokenId,
      token: encrypt(token),
      name: input.wings.nodeName ?? fqdn,
      locationId,
      fqdn,
      scheme,
      memory,
      disk,
      uploadSize,
      daemonListen,
    });

    recordActivity({
      eventType: "admin:node.create",
      userId: adminId,
      nodeId: id,
      properties: { name: input.wings.nodeName ?? fqdn },
    });

    const appUrl = await getEffectiveAppUrl();
    wings = {
      nodeId: id,
      configYaml: buildWingsConfigYaml(
        {
          uuid,
          tokenId,
          token,
          scheme,
          daemonListen,
          daemonSFTP: 2022,
          daemonBase: "/var/lib/pterodactyl",
          uploadSize,
        },
        appUrl,
        { port: 8080, sslEnabled: false },
      ),
    };
  }

  await db
    .insert(settings)
    .values({ key: "setup_complete", value: "true", updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value: "true", updatedAt: new Date() } });

  return { appUrl: await getEffectiveAppUrl(), wings };
}
