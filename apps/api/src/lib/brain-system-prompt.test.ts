import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./brain-system-prompt";

describe("buildSystemPrompt", () => {
  it("returns the base prompt alone for a global conversation", () => {
    const prompt = buildSystemPrompt({ type: "global" });
    expect(prompt).toContain("Canvas's Brain");
    expect(prompt).not.toContain("Title:");
  });

  it("includes task title, list name, and extracted description text for a task conversation", () => {
    const prompt = buildSystemPrompt({
      type: "task",
      title: "Design social banner",
      listName: "Campaigns",
      descriptionJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Needs a red barn." }] }],
      },
    });
    expect(prompt).toContain("Title: Design social banner");
    expect(prompt).toContain("List: Campaigns");
    expect(prompt).toContain("Description: Needs a red barn.");
  });

  it("falls back to a placeholder when the task has no description", () => {
    const prompt = buildSystemPrompt({
      type: "task",
      title: "Untitled work",
      listName: "Backlog",
      descriptionJson: null,
    });
    expect(prompt).toContain("Description: (no description)");
  });
});
