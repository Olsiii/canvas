import { describe, expect, it } from "vitest";
import { actionLabel, principalLabel, resourceLabel } from "./permission-labels";

describe("resourceLabel", () => {
  it("maps a known internal resource name to a human label", () => {
    expect(resourceLabel("customFieldDef")).toBe("Custom fields");
    expect(resourceLabel("hierarchy")).toBe("Spaces & lists");
  });

  it("falls back to the raw resource name if unmapped", () => {
    expect(resourceLabel("somethingNew")).toBe("somethingNew");
  });
});

describe("actionLabel", () => {
  it("combines the resource label and verb", () => {
    expect(actionLabel("task:create")).toBe("Tasks — create");
    expect(actionLabel("imageAsset:view")).toBe("Generated images — view");
  });
});

describe("principalLabel", () => {
  const customRoles = [{ id: "role-1", name: "Reviewer" }];

  it("capitalizes a base membership role", () => {
    expect(principalLabel("role:member", customRoles)).toBe("Member");
  });

  it("resolves a custom role id to its name", () => {
    expect(principalLabel("customRole:role-1", customRoles)).toBe("Reviewer");
  });

  it("falls back gracefully when the custom role no longer exists", () => {
    expect(principalLabel("customRole:role-9", customRoles)).toBe("Deleted custom role");
  });
});
