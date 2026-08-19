import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListMultipartUploadsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3DestinationConfig } from "../lib/backup-destinations";

export const S3_PART_SIZE = 64 * 1024 * 1024;
const PRESIGN_EXPIRY_SECONDS = 14400;
const MAX_PARTS = 10000;
const PARTS_PER_REQUEST = 20;

export function createS3Client(config: S3DestinationConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.usePathStyle,
  });
}

export function backupObjectKey(backupUuid: string): string {
  return `backups/${backupUuid}.tar.gz`;
}

interface MultipartState {
  client: S3Client;
  bucket: string;
  key: string;
  uploadId: string;
}

const multiparts = new Map<string, MultipartState>();

async function ensureMultipart(
  config: S3DestinationConfig,
  backupUuid: string,
): Promise<MultipartState> {
  const key = backupObjectKey(backupUuid);
  const cached = multiparts.get(backupUuid);
  if (cached) return cached;

  const client = createS3Client(config);
  const created = await client.send(
    new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!created.UploadId) {
    throw new Error("CreateMultipartUpload returned no UploadId");
  }
  const state: MultipartState = {
    client,
    bucket: config.bucket,
    key,
    uploadId: created.UploadId,
  };
  multiparts.set(backupUuid, state);
  return state;
}

async function recoverMultipart(
  config: S3DestinationConfig,
  backupUuid: string,
): Promise<MultipartState | null> {
  const client = createS3Client(config);
  const key = backupObjectKey(backupUuid);
  const listed = await client.send(
    new ListMultipartUploadsCommand({ Bucket: config.bucket, Prefix: key }),
  );
  const upload = listed.Uploads?.find((u) => u.Key === key);
  if (!upload?.UploadId) return null;
  return { client, bucket: config.bucket, key, uploadId: upload.UploadId };
}

export async function presignUploadParts(
  config: S3DestinationConfig,
  backupUuid: string,
  size?: number,
  fromPart = 1,
): Promise<{ part_size: number; parts: string[] }> {
  const state = await ensureMultipart(config, backupUuid);

  let partCount: number;
  if (size !== undefined) {
    partCount = Math.max(1, Math.ceil(size / S3_PART_SIZE));
  } else {
    partCount = Math.min(fromPart + PARTS_PER_REQUEST - 1, MAX_PARTS);
  }

  if (fromPart > partCount) {
    return { part_size: S3_PART_SIZE, parts: [] };
  }

  const parts: string[] = [];
  const lastPart = Math.min(partCount, fromPart + PARTS_PER_REQUEST - 1);
  for (let partNumber = fromPart; partNumber <= lastPart; partNumber++) {
    const url = await getSignedUrl(
      state.client,
      new UploadPartCommand({
        Bucket: state.bucket,
        Key: state.key,
        UploadId: state.uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: PRESIGN_EXPIRY_SECONDS },
    );
    parts.push(url);
  }

  return { part_size: S3_PART_SIZE, parts };
}

export async function completeMultipart(
  config: S3DestinationConfig,
  backupUuid: string,
  parts: { etag: string; part_number: number }[],
): Promise<void> {
  const state =
    multiparts.get(backupUuid) ?? (await recoverMultipart(config, backupUuid));
  if (!state) {
    throw new Error(`No multipart upload found for backup ${backupUuid}`);
  }

  await state.client.send(
    new CompleteMultipartUploadCommand({
      Bucket: state.bucket,
      Key: state.key,
      UploadId: state.uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ ETag: p.etag, PartNumber: p.part_number })),
      },
    }),
  );
  multiparts.delete(backupUuid);
}

export async function abortMultipart(
  config: S3DestinationConfig,
  backupUuid: string,
): Promise<void> {
  const state =
    multiparts.get(backupUuid) ?? (await recoverMultipart(config, backupUuid));
  if (!state) return;

  await state.client
    .send(
      new AbortMultipartUploadCommand({
        Bucket: state.bucket,
        Key: state.key,
        UploadId: state.uploadId,
      }),
    )
    .catch(() => {});
  multiparts.delete(backupUuid);
}

export async function presignDownloadUrl(
  config: S3DestinationConfig,
  backupUuid: string,
): Promise<string> {
  const client = createS3Client(config);
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: backupObjectKey(backupUuid),
    }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );
}

export async function deleteBackupObject(
  config: S3DestinationConfig,
  backupUuid: string,
): Promise<void> {
  const client = createS3Client(config);
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: backupObjectKey(backupUuid),
      }),
    );
  } catch {}
}
