import { describe, expect, it } from "vitest";
import { extractMentionedUserIds } from "./mentions";

describe("extractMentionedUserIds", () => {
  it("finds a mention node's user id", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hey " },
            { type: "mention", attrs: { id: "user-1", label: "Ada" } },
          ],
        },
      ],
    };
    expect(extractMentionedUserIds(doc)).toEqual(["user-1"]);
  });

  it("de-dupes repeated mentions of the same user", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "mention", attrs: { id: "user-1" } },
        { type: "mention", attrs: { id: "user-1" } },
      ],
    };
    expect(extractMentionedUserIds(doc)).toEqual(["user-1"]);
  });

  it("returns an empty array for a document with no mentions", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [] }] };
    expect(extractMentionedUserIds(doc)).toEqual([]);
  });

  it("handles null, undefined, and non-object input without throwing", () => {
    expect(extractMentionedUserIds(null)).toEqual([]);
    expect(extractMentionedUserIds(undefined)).toEqual([]);
    expect(extractMentionedUserIds("not a doc")).toEqual([]);
  });

  it("ignores a mention node with a missing or non-string id", () => {
    const doc = { type: "doc", content: [{ type: "mention", attrs: {} }] };
    expect(extractMentionedUserIds(doc)).toEqual([]);
  });
});
