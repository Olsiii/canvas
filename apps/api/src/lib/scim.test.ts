import { describe, expect, it } from "vitest";
import {
  parseScimActivePatch,
  parseUserNameEqFilter,
  toScimListResponse,
  toScimUser,
} from "./scim";

describe("toScimUser", () => {
  it("shapes a membership into a SCIM 2.0 User resource", () => {
    const resource = toScimUser(
      { id: "m1", email: "jane@acme.com", name: "Jane Doe", active: true },
      "https://canvas.local/scim/v2/w1/Users",
    );
    expect(resource).toEqual({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: "m1",
      userName: "jane@acme.com",
      name: { formatted: "Jane Doe" },
      emails: [{ value: "jane@acme.com", primary: true }],
      active: true,
      meta: { resourceType: "User", location: "https://canvas.local/scim/v2/w1/Users/m1" },
    });
  });
});

describe("toScimListResponse", () => {
  it("wraps resources in a SCIM ListResponse envelope", () => {
    const response = toScimListResponse(
      [{ id: "m1", email: "a@acme.com", name: "A", active: true }],
      "https://canvas.local/scim/v2/w1/Users",
    );
    expect(response.totalResults).toBe(1);
    expect(response.Resources).toHaveLength(1);
    expect(response.schemas).toEqual(["urn:ietf:params:scim:api:messages:2.0:ListResponse"]);
  });
});

describe("parseUserNameEqFilter", () => {
  it("extracts the email out of a userName eq filter", () => {
    expect(parseUserNameEqFilter('userName eq "jane@acme.com"')).toBe("jane@acme.com");
  });

  it("returns null for an unsupported filter shape", () => {
    expect(parseUserNameEqFilter("active eq true")).toBeNull();
  });

  it("returns null when no filter is given", () => {
    expect(parseUserNameEqFilter(undefined)).toBeNull();
  });
});

describe("parseScimActivePatch", () => {
  it("reads a path-qualified replace operation", () => {
    expect(
      parseScimActivePatch({ Operations: [{ op: "replace", path: "active", value: false }] }),
    ).toBe(false);
  });

  it("reads a path-less replace operation carrying an object value", () => {
    expect(
      parseScimActivePatch({ Operations: [{ op: "replace", value: { active: false } }] }),
    ).toBe(false);
  });

  it("returns null when the patch doesn't touch active", () => {
    expect(
      parseScimActivePatch({ Operations: [{ op: "replace", path: "userName", value: "x" }] }),
    ).toBeNull();
  });

  it("returns null for a malformed body", () => {
    expect(parseScimActivePatch(null)).toBeNull();
    expect(parseScimActivePatch({})).toBeNull();
  });
});
