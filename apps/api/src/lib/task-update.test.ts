import { describe, expect, it } from "vitest";
import { becameUrgent, buildTaskUpdateFields, computeCompletedAt } from "./task-update";

describe("buildTaskUpdateFields", () => {
  it("includes only the fields actually provided", () => {
    expect(buildTaskUpdateFields({ title: "New title" })).toEqual({ title: "New title" });
  });

  // Regression: a same-column drag reorder sends only orderKey (statusId is
  // unchanged, so the caller omits it). This must not be silently dropped.
  it("applies orderKey even when statusId is not also changing", () => {
    expect(buildTaskUpdateFields({ orderKey: "Zz" })).toEqual({ orderKey: "Zz" });
  });

  it("applies statusId even when orderKey is not also changing", () => {
    expect(buildTaskUpdateFields({ statusId: "s1" })).toEqual({ statusId: "s1" });
  });

  it("applies both together for a cross-column drag", () => {
    expect(buildTaskUpdateFields({ statusId: "s1", orderKey: "a1" })).toEqual({
      statusId: "s1",
      orderKey: "a1",
    });
  });

  it("returns an empty object when nothing changed", () => {
    expect(buildTaskUpdateFields({})).toEqual({});
  });

  it("applies isMilestone independently of other fields", () => {
    expect(buildTaskUpdateFields({ isMilestone: true })).toEqual({ isMilestone: true });
    expect(buildTaskUpdateFields({ isMilestone: false })).toEqual({ isMilestone: false });
  });

  it("distinguishes null (clear the field) from undefined (leave it alone)", () => {
    expect(buildTaskUpdateFields({ priority: null, dueDate: undefined })).toEqual({
      priority: null,
    });
    expect(buildTaskUpdateFields({ dueDate: null })).toEqual({ dueDate: null });
  });

  it("applies descriptionJson, priority, and dates independently of other fields", () => {
    expect(
      buildTaskUpdateFields({
        descriptionJson: { type: "doc", content: [] },
        priority: "urgent",
        startDate: "2026-01-01",
        dueDate: "2026-01-15",
      }),
    ).toEqual({
      descriptionJson: { type: "doc", content: [] },
      descriptionText: "",
      priority: "urgent",
      startDate: "2026-01-01",
      dueDate: "2026-01-15",
    });
  });

  it("derives descriptionText from descriptionJson for search, and clears it alongside a null description", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello world" }] }],
    };
    expect(buildTaskUpdateFields({ descriptionJson: doc })).toEqual({
      descriptionJson: doc,
      descriptionText: "hello world",
    });
    expect(buildTaskUpdateFields({ descriptionJson: null })).toEqual({
      descriptionJson: null,
      descriptionText: null,
    });
  });
});

describe("computeCompletedAt", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("sets completedAt to now when moving into a done/closed kind for the first time", () => {
    expect(computeCompletedAt("done", null, now)).toEqual(now);
    expect(computeCompletedAt("closed", null, now)).toEqual(now);
  });

  it("clears completedAt when moving back to open/active", () => {
    const was = new Date("2026-07-01T00:00:00Z");
    expect(computeCompletedAt("open", was, now)).toBeNull();
    expect(computeCompletedAt("active", was, now)).toBeNull();
  });

  it("preserves an existing completedAt across a lateral move between done and closed", () => {
    const was = new Date("2026-07-01T00:00:00Z");
    expect(computeCompletedAt("closed", was, now)).toEqual(was);
  });

  it("stays null moving between open and active", () => {
    expect(computeCompletedAt("active", null, now)).toBeNull();
  });
});

describe("becameUrgent", () => {
  it("is true when priority moves from something else to urgent", () => {
    expect(becameUrgent("normal", "urgent")).toBe(true);
    expect(becameUrgent(null, "urgent")).toBe(true);
  });

  it("is false when priority was already urgent — no re-broadcast on an unrelated edit", () => {
    expect(becameUrgent("urgent", "urgent")).toBe(false);
  });

  it("is false when priority didn't change at all (update omitted the field)", () => {
    expect(becameUrgent("normal", undefined)).toBe(false);
    expect(becameUrgent("urgent", undefined)).toBe(false);
  });

  it("is false when moving to a non-urgent priority, or clearing it", () => {
    expect(becameUrgent("urgent", "high")).toBe(false);
    expect(becameUrgent("normal", null)).toBe(false);
  });
});
