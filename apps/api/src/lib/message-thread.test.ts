import { describe, expect, it } from "vitest";
import { validateMessageParent } from "./message-thread";

describe("validateMessageParent", () => {
  it("allows a reply to a top-level message in the same channel", () => {
    expect(
      validateMessageParent({ channelId: "channel-1", parentMessageId: null }, "channel-1"),
    ).toBeNull();
  });

  it("rejects a reply to a message in a different channel", () => {
    expect(
      validateMessageParent({ channelId: "channel-1", parentMessageId: null }, "channel-2"),
    ).toMatch(/same channel/);
  });

  it("rejects replying to a reply (depth cap of 2)", () => {
    expect(
      validateMessageParent({ channelId: "channel-1", parentMessageId: "root" }, "channel-1"),
    ).toMatch(/cannot themselves be replied to/);
  });
});
