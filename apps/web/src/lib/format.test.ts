import { describe, expect, it } from "vitest";
import { describeAutomationRunLogEntry, formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-17T12:00:00Z");

  it("shows 'just now' for under a minute", () => {
    expect(formatRelativeTime(new Date("2026-07-17T11:59:31Z"), now)).toBe("just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime(new Date("2026-07-17T11:55:00Z"), now)).toBe("5m ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime(new Date("2026-07-17T09:00:00Z"), now)).toBe("3h ago");
  });

  it("shows days for under a week", () => {
    expect(formatRelativeTime(new Date("2026-07-15T12:00:00Z"), now)).toBe("2d ago");
  });

  it("falls back to a locale date at a week or more", () => {
    const eightDaysAgo = new Date("2026-07-09T12:00:00Z");
    expect(formatRelativeTime(eightDaysAgo, now)).toBe(eightDaysAgo.toLocaleDateString());
  });
});

describe("describeAutomationRunLogEntry", () => {
  it("describes each successful action type in plain English", () => {
    expect(describeAutomationRunLogEntry({ action: "set_priority", ok: true })).toBe(
      "Set the priority",
    );
    expect(describeAutomationRunLogEntry({ action: "add_tag", ok: true })).toBe("Added a tag");
    expect(describeAutomationRunLogEntry({ action: "post_comment", ok: true })).toBe(
      "Posted a comment",
    );
    expect(describeAutomationRunLogEntry({ action: "generate_image", ok: true })).toBe(
      "Started generating an image",
    );
    expect(describeAutomationRunLogEntry({ action: "slack_notify", ok: true })).toBe(
      "Sent a Slack message",
    );
  });

  it("describes a failure with its error message appended", () => {
    expect(
      describeAutomationRunLogEntry({
        action: "slack_notify",
        ok: false,
        error: "Webhook URL unreachable",
      }),
    ).toBe("Sending a Slack message failed: Webhook URL unreachable");
  });

  it("still describes a failure with no error message", () => {
    expect(describeAutomationRunLogEntry({ action: "add_tag", ok: false })).toBe(
      "Adding a tag failed",
    );
  });
});
