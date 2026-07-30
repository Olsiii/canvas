import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
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

  // Large-attachment uploads (attachment.presignUpload) PUT straight from
  // the browser to the bucket, bypassing the API — that only works if the
  // bucket itself allows cross-origin PUTs from the web app's origin.
  // Fastify's own CORS registration (index.ts) is unrelated; this is a
  // bucket-level policy the S3/MinIO server enforces on direct requests.
  // MinIO (local dev) doesn't implement the S3 PutBucketCors API at all —
  // confirmed live, it 501s "NotImplemented" — and is configured instead
  // via the MINIO_API_CORS_ALLOW_ORIGIN server env var in docker-compose.yml.
  // Real S3/R2 do support this call, so it's still attempted and only
  // swallowed on failure rather than skipped outright — a provider that
  // supports it gets it applied for real; one that doesn't (MinIO) falls
  // back to however its own CORS is configured, without crashing startup.
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [env.WEB_URL],
              AllowedMethods: ["PUT", "GET"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  } catch (err) {
    console.warn(
      "storage: bucket-level CORS not supported by this S3 endpoint, skipping (fine for MinIO — see docker-compose.yml's MINIO_API_CORS_ALLOW_ORIGIN instead):",
      err instanceof Error ? err.message : err,
    );
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

// Returns null if the object doesn't exist (a confirmUpload call for a PUT
// that never actually landed) rather than throwing — the caller treats
// "not there" as an ordinary validation failure, not a server error.
export async function headObject(key: string) {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch {
    return null;
  }
}

// Direct browser-to-storage upload (attachment.presignUpload) — the one
// exception to M1.9's "no presigned URLs, the API streams every byte
// itself" decision, made specifically for multi-GB files (3D/video assets)
// that would otherwise have to be buffered whole in the API's memory by
// @fastify/multipart before ever reaching S3. Downloads are untouched:
// GET /uploads/:id still streams through the app with a permission check
// on every request, so MinIO/S3 still isn't reachable by the browser for
// reads. Signing the PUT with a fixed ContentType means the object can
// only be uploaded with that exact Content-Type header — the presigned
// URL can't be reused to upload a differently-typed file than what was
// authorized.
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
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
