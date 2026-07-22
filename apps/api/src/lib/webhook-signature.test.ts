import { describe, expect, it } from "vitest";
import { generateWebhookSecret, signWebhookPayload } from "./webhook-signature";

describe("generateWebhookSecret", () => {
  it("returns a 48-char hex string", () => {
    expect(generateWebhookSecret()).toMatch(/^[0-9a-f]{48}$/);
  });

  it("never generates the same secret twice", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe("signWebhookPayload", () => {
  it("is deterministic for the same secret and body", () => {
    expect(signWebhookPayload("s3cret", '{"a":1}')).toBe(signWebhookPayload("s3cret", '{"a":1}'));
  });

  it("differs when the body changes", () => {
    expect(signWebhookPayload("s3cret", '{"a":1}')).not.toBe(
      signWebhookPayload("s3cret", '{"a":2}'),
    );
  });

  it("differs when the secret changes", () => {
    expect(signWebhookPayload("s3cret-a", '{"a":1}')).not.toBe(
      signWebhookPayload("s3cret-b", '{"a":1}'),
    );
  });
});
