import { describe, expect, it } from "vitest";
import { validateCommentParent } from "./comment-thread";

describe("validateCommentParent", () => {
  it("allows a reply to a top-level comment on the same task", () => {
    expect(
      validateCommentParent({ taskId: "task-1", parentCommentId: null }, "task-1"),
    ).toBeNull();
  });

  it("rejects a reply to a comment on a different task", () => {
    expect(
      validateCommentParent({ taskId: "task-1", parentCommentId: null }, "task-2"),
    ).toMatch(/same task/);
  });

  it("rejects replying to a reply (depth cap of 2)", () => {
    expect(
      validateCommentParent({ taskId: "task-1", parentCommentId: "root" }, "task-1"),
    ).toMatch(/cannot themselves be replied to/);
  });
});
