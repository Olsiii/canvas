import { describe, expect, it } from "vitest";
import { isInlineSafeMimeType, safeContentType } from "./mime-safety";

describe("isInlineSafeMimeType", () => {
  it("allows common safe image/video/audio/document types", () => {
    expect(isInlineSafeMimeType("image/png")).toBe(true);
    expect(isInlineSafeMimeType("video/mp4")).toBe(true);
    expect(isInlineSafeMimeType("audio/mpeg")).toBe(true);
    expect(isInlineSafeMimeType("application/pdf")).toBe(true);
  });

  it("rejects text/html — the primary stored-XSS-via-upload vector", () => {
    expect(isInlineSafeMimeType("text/html")).toBe(false);
  });

  it("rejects image/svg+xml even though it's an image/* type", () => {
    expect(isInlineSafeMimeType("image/svg+xml")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isInlineSafeMimeType("IMAGE/PNG")).toBe(true);
  });

  it("rejects unknown/unlisted mime types by default (allowlist, not blocklist)", () => {
    expect(isInlineSafeMimeType("application/x-msdownload")).toBe(false);
    expect(isInlineSafeMimeType("application/octet-stream")).toBe(false);
  });
});

describe("safeContentType", () => {
  it("passes through a safe mime type unchanged", () => {
    expect(safeContentType("image/png")).toBe("image/png");
  });

  it("downgrades an unsafe mime type to application/octet-stream", () => {
    expect(safeContentType("text/html")).toBe("application/octet-stream");
    expect(safeContentType("image/svg+xml")).toBe("application/octet-stream");
  });
});
