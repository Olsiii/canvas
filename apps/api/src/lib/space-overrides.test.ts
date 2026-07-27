import { describe, expect, it } from "vitest";
import { principalKey } from "./space-overrides";

describe("principalKey", () => {
  it("encodes a built-in role", () => {
    expect(principalKey({ role: "admin" })).toBe("role:admin");
  });

  it("encodes a custom role id", () => {
    expect(principalKey({ customRoleId: "abc-123" })).toBe("customRole:abc-123");
  });

  it("distinguishes a role name from a custom role id even if they collide as strings", () => {
    expect(principalKey({ role: "admin" })).not.toBe(principalKey({ customRoleId: "admin" }));
  });
});
