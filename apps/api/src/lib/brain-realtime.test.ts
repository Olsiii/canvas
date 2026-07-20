import { describe, expect, it } from "vitest";
import { brainChannel } from "./brain-realtime";

describe("brainChannel", () => {
  it("prefixes conversation ids for Redis pub/sub", () => {
    expect(brainChannel("019abcdef-0000-7000-8000-000000000001")).toBe(
      "brain:019abcdef-0000-7000-8000-000000000001",
    );
  });
});
