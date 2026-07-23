import { createHash, randomBytes } from "node:crypto";

// Same shape as api-key.ts's cnv_ prefix — recognizable at a glance,
// distinct prefix so a leaked SCIM token isn't mistaken for a regular API key.
const TOKEN_PREFIX = "cnv_scim_";

export function generateScimToken(): { raw: string; hash: string } {
  const raw = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashScimToken(raw) };
}

/** SHA-256 — already high-entropy, same reasoning as api-key.ts's hashApiKey. */
export function hashScimToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
