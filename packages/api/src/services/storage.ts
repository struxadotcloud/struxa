import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { env } from "@struxa/env/server";

const s3 = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function tryEnsureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === 403) {
      await s3.send(new CreateBucketCommand({ Bucket: env.MINIO_BUCKET }));
    } else {
      throw err;
    }
  }
}

let bucketReady: Promise<void> = tryEnsureBucket();

// If the previous attempt failed, reset so the next call gets a fresh try
async function requireBucket(): Promise<void> {
  try {
    await bucketReady;
  } catch {
    bucketReady = tryEnsureBucket();
    await bucketReady;
  }
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await requireBucket();
  await s3.send(new PutObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<{ stream: ReadableStream; etag: string | undefined }> {
  await requireBucket();
  const res = await s3.send(new GetObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }));
  if (!res.Body) throw new Error("Empty body");
  return { stream: res.Body.transformToWebStream(), etag: res.ETag };
}

export async function headObject(key: string): Promise<{ etag: string | undefined }> {
  await requireBucket();
  const res = await s3.send(new HeadObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }));
  return { etag: res.ETag };
}

export async function deleteObject(key: string): Promise<void> {
  await requireBucket();
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }));
  } catch {
    // swallow NoSuchKey
  }
}
