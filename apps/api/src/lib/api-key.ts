import { createHash, randomBytes } from "node:crypto";

// Prefixed so a leaked key is recognizable at a glance (same idea as
// Stripe/GitHub tokens) — DATA_MODEL.md's api_keys row has no separate
// "prefix" column to display post-creation, so the raw value is shown
// exactly once (api-key.ts router's create) and never again.
const KEY_PREFIX = "cnv_";

export function generateApiKey(): { raw: string; hash: string } {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashApiKey(raw) };
}

/** SHA-256 — an API key is already high-entropy, unlike a user password, so a plain fast hash (not bcrypt) is standard practice here. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
