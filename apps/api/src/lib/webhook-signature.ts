import { createHmac, randomBytes } from "node:crypto";

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

/** HMAC-SHA256 of the exact (already-serialized) request body, hex-encoded — sent as the `X-Canvas-Signature` header so a receiver can verify the payload wasn't tampered with in transit. */
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
