import { describe, expect, it } from "vitest";
import { buildDigestEmail } from "./digest";

describe("buildDigestEmail", () => {
  it("singularizes the subject/body for exactly one notification", () => {
    const { subject, text } = buildDigestEmail(
      [{ verb: "comment.created", actorName: "Ada" }],
      "http://localhost:5183",
    );
    expect(subject).toBe("1 new notification on Canvas");
    expect(text).toContain("You have 1 new notification:");
  });

  it("pluralizes for more than one notification", () => {
    const { subject, text } = buildDigestEmail(
      [
        { verb: "comment.created", actorName: "Ada" },
        { verb: "reminder.fired", actorName: "Ada" },
      ],
      "http://localhost:5183",
    );
    expect(subject).toBe("2 new notifications on Canvas");
    expect(text).toContain("You have 2 new notifications:");
  });

  it("maps each notification's verb to its human label and includes the actor", () => {
    const { text } = buildDigestEmail(
      [{ verb: "comment.created", actorName: "Bob" }],
      "http://localhost:5183",
    );
    expect(text).toContain("- Bob mentioned you in a comment");
  });

  it("falls back to the raw verb for an unmapped one", () => {
    const { text } = buildDigestEmail(
      [{ verb: "task.recurrence_spawned", actorName: "Ada" }],
      "http://localhost:5183",
    );
    expect(text).toContain("- Ada task.recurrence_spawned");
  });

  it("includes the web URL as a link back into the app", () => {
    const { text } = buildDigestEmail(
      [{ verb: "comment.created", actorName: "Ada" }],
      "https://canvas.example.com",
    );
    expect(text).toContain("Open Canvas: https://canvas.example.com");
  });
});
