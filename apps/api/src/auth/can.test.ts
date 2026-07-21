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

  it("only allows admins+ to manage members (role changes, removal)", () => {
    expect(can(user, "workspace:manage", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "workspace:manage", { type: "workspace", role: "admin" })).toBe(true);
    expect(can(user, "workspace:manage", { type: "workspace", role: "owner" })).toBe(true);
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

  it("only allows admins+ to delete statuses, but members can create/update them", () => {
    expect(can(user, "status:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "status:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "status:delete", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "status:delete", { type: "workspace", role: "admin" })).toBe(true);
  });

  it("allows members to fully manage tasks, including delete", () => {
    expect(can(user, "task:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "task:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "task:delete", { type: "workspace", role: "member" })).toBe(true);
  });

  it("allows guests to view and post comments, unlike creating tasks", () => {
    expect(can(user, "comment:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "comment:create", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "comment:create", { type: "workspace", role: null })).toBe(false);
  });

  it("only allows admins+ to delete tags, but members can create them", () => {
    expect(can(user, "tag:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "tag:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "tag:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "tag:delete", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "tag:delete", { type: "workspace", role: "admin" })).toBe(true);
  });

  it("only allows admins+ to delete custom field defs, but members can create/update them and set values", () => {
    expect(can(user, "customFieldDef:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "customFieldDef:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "customFieldDef:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "customFieldDef:delete", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "customFieldDef:delete", { type: "workspace", role: "admin" })).toBe(true);
    expect(can(user, "customFieldValue:update", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "customFieldValue:update", { type: "workspace", role: "guest" })).toBe(false);
  });

  it("allows guests to view attachments, but only members can upload/delete them", () => {
    expect(can(user, "attachment:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "attachment:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "attachment:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "attachment:delete", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "attachment:delete", { type: "workspace", role: "member" })).toBe(true);
  });

  it("allows guests to view image assets, but only members can generate/edit them", () => {
    expect(can(user, "imageAsset:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "imageAsset:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "imageAsset:create", { type: "workspace", role: "member" })).toBe(true);
  });

  it("allows guests to view Brain conversations, but only members can send chat messages", () => {
    expect(can(user, "brain:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "brain:chat", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "brain:chat", { type: "workspace", role: "member" })).toBe(true);
  });

  it("allows guests to view brand settings, but only admins can update them", () => {
    expect(can(user, "brandSettings:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "brandSettings:update", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "brandSettings:update", { type: "workspace", role: "admin" })).toBe(true);
  });

  it("only allows admins+ to delete task templates, but members can create them", () => {
    expect(can(user, "taskTemplate:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "taskTemplate:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "taskTemplate:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "taskTemplate:delete", { type: "workspace", role: "member" })).toBe(false);
    expect(can(user, "taskTemplate:delete", { type: "workspace", role: "admin" })).toBe(true);
  });

  it("allows guests to view docs, but only members can create/update/delete them", () => {
    expect(can(user, "doc:view", { type: "workspace", role: "guest" })).toBe(true);
    expect(can(user, "doc:create", { type: "workspace", role: "guest" })).toBe(false);
    expect(can(user, "doc:create", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "doc:update", { type: "workspace", role: "member" })).toBe(true);
    expect(can(user, "doc:delete", { type: "workspace", role: "guest" })).toBe(false);
  });
});
