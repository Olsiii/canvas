import { describe, expect, it } from "vitest";
import { referenceContextSuffix, type ResolvedAiReference } from "./ai-references";

describe("referenceContextSuffix", () => {
  it("returns empty when every ref is an image", () => {
    const refs: ResolvedAiReference[] = [
      {
        attachmentId: "a",
        fileName: "mood.png",
        mime: "image/png",
        imageVersionId: "v1",
        imageUrl: "https://example.com/x",
      },
    ];
    expect(referenceContextSuffix(refs)).toBe("");
  });

  it("lists non-image files for prompt context", () => {
    const refs: ResolvedAiReference[] = [
      {
        attachmentId: "a",
        fileName: "brief.pdf",
        mime: "application/pdf",
        imageVersionId: null,
        imageUrl: null,
      },
      {
        attachmentId: "b",
        fileName: "clip.webm",
        mime: "video/webm",
        imageVersionId: null,
        imageUrl: null,
      },
    ];
    const suffix = referenceContextSuffix(refs);
    expect(suffix).toContain("brief.pdf");
    expect(suffix).toContain("clip.webm");
    expect(suffix).toContain("Attached reference files");
  });
});
