import { describe, expect, it } from "vitest";
import { sanitizeFilenameForKey, sanitizeForHeader } from "./filename";

describe("sanitizeFilenameForKey", () => {
  it("strips unix-style directory traversal down to the basename", () => {
    expect(sanitizeFilenameForKey("../../etc/passwd")).toBe("passwd");
  });

  it("strips windows-style directory traversal down to the basename", () => {
    expect(sanitizeFilenameForKey("..\\..\\windows\\system32\\config")).toBe("config");
  });

  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeFilenameForKey("my file (1).png")).toBe("my_file__1_.png");
  });

  it("collapses a leading dot instead of leaving a hidden-file-like name", () => {
    expect(sanitizeFilenameForKey(".hidden")).toBe("_hidden");
  });

  it("collapses an all-dots name to a single underscore, never a bare path segment", () => {
    expect(sanitizeFilenameForKey("...")).toBe("_");
    expect(sanitizeFilenameForKey("..")).toBe("_");
  });

  it("falls back to a default name when nothing safe survives", () => {
    expect(sanitizeFilenameForKey("")).toBe("file");
  });

  it("truncates very long filenames", () => {
    const long = "a".repeat(500) + ".png";
    expect(sanitizeFilenameForKey(long).length).toBeLessThanOrEqual(200);
  });

  it("leaves an already-safe filename untouched", () => {
    expect(sanitizeFilenameForKey("design-v2_final.png")).toBe("design-v2_final.png");
  });
});

describe("sanitizeForHeader", () => {
  it("strips quotes and CR/LF that would break a Content-Disposition header", () => {
    expect(sanitizeForHeader('evil".png\r\nX-Injected: 1')).toBe("evil.pngX-Injected: 1");
  });

  it("leaves a normal filename untouched", () => {
    expect(sanitizeForHeader("design.png")).toBe("design.png");
  });
});
