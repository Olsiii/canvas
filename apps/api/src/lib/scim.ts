// SCIM 2.0 (RFC 7643/7644) — Users resource only, see PROGRESS.md (Phase 6
// decisions) for why Groups aren't in scope for v1. Pure formatting/parsing
// kept separate from the DB-touching route handlers (routes/scim.ts), same
// "pure/impure split" this codebase already uses (e.g. automation-engine.ts
// vs automation-runner.ts) so the SCIM wire-format logic is unit-testable
// without spinning up a database.

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

export interface ScimUserSource {
  /** membership id — SCIM's resource id is "this person's presence in this workspace", not the global user id. */
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export function toScimUser(source: ScimUserSource, baseUrl: string) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: source.id,
    userName: source.email,
    name: { formatted: source.name },
    emails: [{ value: source.email, primary: true }],
    active: source.active,
    meta: { resourceType: "User", location: `${baseUrl}/${source.id}` },
  };
}

export function toScimListResponse(sources: ScimUserSource[], baseUrl: string) {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: sources.length,
    startIndex: 1,
    itemsPerPage: sources.length,
    Resources: sources.map((s) => toScimUser(s, baseUrl)),
  };
}

/**
 * `filter=userName eq "..."` is the one filter shape every SCIM-compliant
 * IdP connector (Okta, Azure AD) sends before provisioning, to check
 * whether a user already exists — v1 supports exactly that shape, nothing
 * more general.
 */
export function parseUserNameEqFilter(filter: string | undefined): string | null {
  if (!filter) return null;
  const match = /^userName eq "([^"]*)"$/.exec(filter.trim());
  return match ? match[1]! : null;
}

interface ScimPatchOperation {
  op?: string;
  path?: string;
  value?: unknown;
}

/**
 * Extracts a requested `active` value out of a SCIM PATCH body — IdPs
 * disagree on the exact shape (Okta sends `{op:"replace", path:"active",
 * value:false}`; some send `{op:"replace", value:{active:false}}` with no
 * path), so both are accepted. Returns null when the patch doesn't touch
 * `active` at all (a no-op from this app's point of view — Canvas's
 * membership model has no other SCIM-patchable field, see PROGRESS.md).
 */
export function parseScimActivePatch(body: unknown): boolean | null {
  if (typeof body !== "object" || body === null) return null;
  const operations = (body as { Operations?: unknown }).Operations;
  if (!Array.isArray(operations)) return null;

  for (const raw of operations as ScimPatchOperation[]) {
    if (raw.path === "active" && typeof raw.value === "boolean") return raw.value;
    if (
      !raw.path &&
      typeof raw.value === "object" &&
      raw.value !== null &&
      typeof (raw.value as { active?: unknown }).active === "boolean"
    ) {
      return (raw.value as { active: boolean }).active;
    }
  }
  return null;
}
