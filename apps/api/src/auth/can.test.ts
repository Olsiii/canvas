import { describe, expect, it } from "vitest";
import { can } from "./can";
import type { SessionUser } from "./session";

const user: SessionUser = { id: "u1", email: "a@example.com", name: "A", avatarUrl: null };

describe("can", () => {
  it("denies non-members", () => {
    expect(can(user, "workspace:invite", { type: "workspace", role: null })).toBe(false);
  });

  it("denies members from inviting", () => {
    expect(can(user, "workspace:invite", { type: "workspace", role: "member" })).toBe(false);
  });

  it("allows admins to invite", () => {
    expect(can(user, "workspace:invite", { type: "workspace", role: "admin" })).toBe(true);
  });

  it("allows owners to invite", () => {
    expect(can(user, "workspace:invite", { type: "workspace", role: "owner" })).toBe(true);
  });

  it("only allows owners to delete the workspace", () => {
    expect(can(user, "workspace:delete", { type: "workspace", role: "admin" })).toBe(false);
    expect(can(user, "workspace:delete", { type: "workspace", role: "owner" })).toBe(true);
  });

  it("allows any member (including guests) to view the hierarchy", () => {
    expect(can(user, "hierarchy:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "hierarchy:view", { type: "workspace", role: "owner" })).toBe(true);
    expect(can(user, "hierarchy:view", { type: "workspace", role: null })).toBe(false);
  });

  it("denies guests from creating spaces/folders/lists, allows members+", () => {
    expect(can(user, "hierarchy:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "hierarchy:create", { type: "workspace", role: "member" })).toBe(true);
  });

  it("only allows admins+ to delete spaces/folders/lists", () => {
    expect(can(user, "hierarchy:delete", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "hierarchy:delete", { type: "workspace", role: "admin" })).toBe(true);
  });
});
