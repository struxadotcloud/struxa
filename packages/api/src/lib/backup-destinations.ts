import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { backupDestinations } from "@struxa/db";
import { decrypt } from "./crypto";

export const BACKUP_DESTINATION_TYPES = [
  "wings",
  "ddup_bak",
  "s3",
  "restic",
  "pbs",
  "kopia",
] as const;

export type BackupDestinationType = (typeof BACKUP_DESTINATION_TYPES)[number];

const s3ConfigSchema = z.object({
  endpoint: z.string().min(1),
  region: z.string().min(1).default("us-east-1"),
  bucket: z.string().min(1),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  usePathStyle: z.boolean().default(true),
  allowPublicDownload: z.boolean().default(false),
});

const resticConfigSchema = z.object({
  repository: z.string().min(1),
  password: z.string().optional(),
  retryLockSeconds: z.number().int().min(0).default(10),
  environment: z.record(z.string(), z.string()).default({}),
});

const pbsConfigSchema = z.object({
  url: z.string().min(1),
  datastore: z.string().min(1),
  namespace: z.string().optional(),
  tokenId: z.string().min(1),
  tokenSecret: z.string().min(1),
  fingerprint: z.string().optional(),
  backupIdPrefix: z.string().optional(),
});

const kopiaConfigSchema = z.object({
  url: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  fingerprint: z.string().optional(),
  tags: z.record(z.string(), z.string()).default({}),
});

export const backupDestinationInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wings") }),
  z.object({ type: z.literal("ddup_bak") }),
  z.object({ type: z.literal("s3"), ...s3ConfigSchema.shape }),
  z.object({ type: z.literal("restic"), ...resticConfigSchema.shape }),
  z.object({ type: z.literal("pbs"), ...pbsConfigSchema.shape }),
  z.object({ type: z.literal("kopia"), ...kopiaConfigSchema.shape }),
]);

export type BackupDestinationInput = z.infer<typeof backupDestinationInputSchema>;

export type S3DestinationConfig = z.infer<typeof s3ConfigSchema>;
export type ResticDestinationConfig = z.infer<typeof resticConfigSchema>;
export type PbsDestinationConfig = z.infer<typeof pbsConfigSchema>;
export type KopiaDestinationConfig = z.infer<typeof kopiaConfigSchema>;

export function adapterStringForType(type: BackupDestinationType): string {
  switch (type) {
    case "wings":
      return "wings";
    case "ddup_bak":
      return "ddup-bak";
    case "s3":
      return "s3";
    case "restic":
      return "restic";
    case "pbs":
      return "proxmox-backup-server";
    case "kopia":
      return "kopia";
  }
}

function parseDestinationRow(
  row: typeof backupDestinations.$inferSelect,
): BackupDestinationInput | null {
  try {
    const config = JSON.parse(decrypt(row.config)) as Record<string, unknown>;
    return backupDestinationInputSchema.parse({ type: row.type, ...config });
  } catch {
    return null;
  }
}

export async function getDestinationForNode(
  nodeId: string | null,
): Promise<BackupDestinationInput | null> {
  const row = await db.query.backupDestinations.findFirst({
    where: nodeId
      ? eq(backupDestinations.nodeId, nodeId)
      : isNull(backupDestinations.nodeId),
  });
  return row ? parseDestinationRow(row) : null;
}

export async function resolveDestinationForNode(
  nodeId: string,
): Promise<BackupDestinationInput | null> {
  const nodeDestination = await getDestinationForNode(nodeId);
  if (nodeDestination) return nodeDestination;
  return getDestinationForNode(null);
}
