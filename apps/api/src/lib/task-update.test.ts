import { describe, expect, it } from "vitest";
import { buildTaskUpdateFields } from "./task-update";

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
      priority: "urgent",
      startDate: "2026-01-01",
      dueDate: "2026-01-15",
    });
  });
});
