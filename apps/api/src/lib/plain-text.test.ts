import { describe, expect, it } from "vitest";
import { extractPlainText } from "./plain-text";

describe("extractPlainText", () => {
  it("concatenates text nodes across paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "world" }] },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hello world");
  });

  it("concatenates multiple text nodes within one paragraph", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold" },
            { type: "text", text: " and plain" },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("bold  and plain");
  });

  it("returns an empty string for an empty doc", () => {
    expect(extractPlainText({ type: "doc", content: [] })).toBe("");
  });

  it("returns an empty string for null/undefined/non-object input", () => {
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
    expect(extractPlainText("plain string")).toBe("");
  });

  it("skips non-text nodes with no content (e.g. a hard break)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "line one" }, { type: "hardBreak" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("line one");
  });
});
