import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

// MinIO doesn't ship with the dev bucket pre-created (unlike Postgres,
// which gets its DB from docker-compose env vars) — create it idempotently
// on startup rather than requiring a manual `mc mb` step.
export async function ensureBucketExists() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

// Server-to-external-provider only (the image-generation worker handing a
// source image to an ImageEngine adapter's edit() call) — not exposed to
// the browser. Distinct from M1.9's decision to stream every attachment
// byte through the app rather than issue presigned URLs, which was
// specifically about not exposing MinIO to the browser directly; this is a
// different boundary (server -> external API), where a short-lived
// presigned URL is the standard, simplest way to hand off image bytes.
export async function getPresignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
