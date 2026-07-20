import { describe, expect, it } from "vitest";
import { BRAIN_TOOLS, isToolName, parseToolInput } from "./tools";

describe("brain tools", () => {
  it("exports the four M2.3 tools", () => {
    expect(BRAIN_TOOLS.map((t) => t.name)).toEqual([
      "generate_image",
      "edit_image",
      "attach_to_task",
      "summarize_thread",
    ]);
  });

  it("parses generate_image with default size", () => {
    expect(parseToolInput("generate_image", { prompt: "a red banner" })).toEqual({
      prompt: "a red banner",
      size: "square",
    });
  });

  it("rejects empty generate prompts", () => {
    expect(() => parseToolInput("generate_image", { prompt: "  " })).toThrow();
  });

  it("requires image_version_id for edit_image", () => {
    expect(() => parseToolInput("edit_image", { instruction: "make it blue" })).toThrow();
  });

  it("isToolName narrows known names", () => {
    expect(isToolName("generate_image")).toBe(true);
    expect(isToolName("search_workspace")).toBe(false);
  });
});
