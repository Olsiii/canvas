# PROGRESS.md

## Phase 0 — Foundation

### M0.1 — Monorepo scaffold — done (2026-07-16)

Built:

- pnpm workspaces + Turborepo at the root (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`).
- `apps/web` — Vite + React 19 + TypeScript, Tailwind v4 + a hand-rolled shadcn/ui `Button` (`components.json` configured for the CLI), TanStack Query + Router + Table, dnd-kit, tRPC client wired to the API.
- `apps/api` — Fastify 5 + tRPC v11 server with a `health` procedure and a `/health` REST route, zod-validated env.
- `packages/db` — Drizzle ORM configured for Postgres (`drizzle.config.ts`, `src/client.ts`); `src/schema/index.ts` left empty — tables land in M0.2 (auth) and M1.
- `packages/shared` — package scaffold only (`APP_NAME` constant as a wiring smoke test); real zod schemas/types land as Phase 1 features need them.
- Root ESLint flat config (typescript-eslint + react-hooks/react-refresh for `apps/web`), Prettier.
- `docker-compose.yml` — Postgres 16, Redis 7, MinIO, with healthchecks and named volumes.
- `.env.example` at the root (DB/Redis/S3 vars + API port).

### Decisions

- **Code-based TanStack Router instead of file-based routing.** The file-based generator (`@tanstack/router-plugin`) writes `routeTree.gen.ts` as a Vite plugin side effect, which breaks a plain `tsc -b` typecheck run when the file doesn't exist yet (no build has happened). With only one route so far, code-based routing (`createRootRoute`/`createRoute`/`.addChildren`) avoids the ordering problem entirely. Revisit file-based routing once there are enough routes (Phase 1) to justify the codegen.
- **tRPC v11, not v10.** ARCHITECTURE.md didn't pin a major version. v10's `@trpc/react-query` imports `hashQueryKey` from `@tanstack/react-query`, which was removed in current v5 releases — the production build failed until upgrading to v11 (`@trpc/server`, `@trpc/client`, `@trpc/react-query` all `^11.18.0`).
- `packages/db` has no tests yet (empty schema), so its `test` script runs `vitest run --passWithNoTests` rather than failing on zero test files.
- `PRD.md`/`ARCHITECTURE.md`/`DATA_MODEL.md`/`ROADMAP.md`/`CLAUDE.md` are excluded from Prettier — they're spec source-of-truth docs, not ours to reformat.

### Verified

- `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check` all pass.
- `docker compose up` brings up Postgres/Redis/MinIO, all report healthy.
- `apps/api` dev server: `/health` and `/trpc/health` both respond `{ ok: true }`.
- `apps/web` dev server proxies `/trpc` to the API; loaded the page in a real browser and confirmed it renders "api status: connected".

### TODOs / not done here (later milestones)

- M0.3: CI (typecheck + lint + vitest + drizzle migration check on every push).

### M0.2 — Auth: email/password + Google OAuth, sessions, workspace creation, invites, roles — done (2026-07-16)

Built:

- `packages/db/src/schema`: `users`, `sessions`, `workspaces`, `memberships` (all per DATA_MODEL.md) plus `invites` and `activity` (see Decisions). First migration generated and applied (`packages/db/drizzle/0000_living_valkyrie.sql`).
- `packages/shared`: `roles.ts` (`MEMBERSHIP_ROLES`, `ROLE_RANK`) and zod schemas for sign-up/log-in/create-workspace/invite/accept-invite, shared by web and api.
- `apps/api/src/auth/`: `password.ts` (argon2 hash/verify via `@node-rs/argon2`), `session.ts` (create/validate/invalidate against the `sessions` table, sliding renewal inside 15 days of expiry), `cookies.ts`, `can.ts` (the required `can(user, action, resource)` permission helper — pure function, role-rank based, unit tested), `google.ts` (arctic `Google` OAuth client + userinfo fetch).
- `apps/api/src/trpc/trpc.ts`: base tRPC setup (`router`, `publicProcedure`, `protectedProcedure`) split out of `router.ts` — see Decisions (circular import).
- `apps/api/src/trpc/routers/auth.ts`: `signUp`, `logIn`, `logOut`, `me`. `signUp` auto-accepts a pending invite in the same mutation when `inviteId` is passed and the invite's email matches.
- `apps/api/src/trpc/routers/workspace.ts`: `create` (slugify + collision retry, owner membership, `activity` row), `invite` (owner/admin only via `can()`), `getInvite` (public, for the invite landing page), `acceptInvite` (email-matched, idempotent).
- `apps/api/src/routes/auth.ts`: plain Fastify routes `GET /auth/google` and `GET /auth/google/callback` (OAuth is a redirect flow, not RPC) — state/PKCE verifier in short-lived cookies, upserts user by email, creates a session, redirects back to `WEB_URL`.
- `apps/web`: `/signup`, `/login` (with `redirect` search param for the "log in then accept invite" path), `/workspaces/new`, `/invite/$inviteId`, dashboard at `/` (workspace list + inline invite form + invite-link display, since there's no email delivery yet). `RequireAuth` wrapper + `useSession()` hook (`trpc.auth.me.useQuery()`) gate protected routes.

### Decisions

- **`invites` and `activity` tables aren't in DATA_MODEL.md** — `activity` _is_ listed there (Core section) and is added now rather than at Phase 1 because CLAUDE.md's hard rule ("every user-visible mutation writes an activity row") applies to workspace creation, which is Phase 0 scope. `invites` has no schema in DATA_MODEL.md at all; added `invites(id, workspace_id, email, role, invited_by, expires_at, accepted_at, created_at)` as the simplest option consistent with ARCHITECTURE.md's conventions (UUIDv7 id, the row's own `id` doubles as the unguessable invite-link token — 74 bits of randomness, same order as a v4 UUID token).
- **No email delivery.** Notifications/email land in Phase 1 (M1.7) and Phase 3, not M0.2. `workspace.invite` returns the invite row; the dashboard shows the `/invite/{id}` link as copyable text for the owner/admin to send manually.
- **Session token = the session row's own UUIDv7 `id`**, not a separately hashed token (the more common "Lucia guide" pattern). Chosen for consistency with CLAUDE.md's unconditional "UUIDv7 ids everywhere" rule and because DATA_MODEL.md's `sessions` table has no separate token column — the 128-bit id (74 bits random) is possession-based and validated server-side against Postgres on every request, so this is not meaningfully weaker for a session cookie.
- **Auth library: hand-rolled sessions + `@node-rs/argon2` + `arctic`, not Lucia-the-library.** ARCHITECTURE.md said "Lucia or Auth.js"; Lucia's session/password patterns are used directly (matching DATA_MODEL.md's `sessions` shape) via `arctic` (same author, still an actively maintained standalone OAuth client) for Google OAuth, rather than pulling in a framework-shaped library. Noting this as a build-time judgment call per CLAUDE.md's "verify current libraries" guidance.
- **Split `apps/api/src/trpc/trpc.ts` out of `router.ts`.** The sub-routers (`routers/auth.ts`, `routers/workspace.ts`) need `publicProcedure`/`protectedProcedure`, and `router.ts` imports the sub-routers — a circular import that left `publicProcedure` `undefined` at module-eval time. Base tRPC primitives now live in their own module with no dependents importing back into it.
- **Google OAuth is implemented but not live-tested** — no `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are available in this environment. `GET /auth/google` redirects to `/login?error=google_not_configured` when unset, so the app degrades gracefully. To test for real: create OAuth creds in Google Cloud Console, set the two env vars (see `.env.example`), and the existing `/auth/google` → `/auth/google/callback` flow should work as coded.

### Verified

- Migration generated (`db:generate`) and applied (`db:migrate`) against the Docker Postgres; `\dt` confirms all 6 tables.
- `pnpm typecheck`, `pnpm build`, `pnpm test` (`can()` unit tests + existing suites), `pnpm lint`, `pnpm format:check` all pass.
- Full accept-criteria flow driven through a real browser end to end:
  - Alice signs up (email/password) → lands on `/`.
  - Alice creates workspace "Acme Marketing" → becomes `owner`.
  - Alice invites `carol@example.com` → gets an invite link.
  - Logged out; visited the invite link unauthenticated → correct "sign up with this email" / "log in" prompt.
  - Carol signs up via the invite link (`/signup?invite=...`, email locked) → invite auto-accepted in the same mutation → Carol is `member`.
  - Alice logs back in independently → still `owner` → invites `bob@example.com` (pre-existing account) → invite link.
  - Visited invite link while still logged in as Alice → correctly blocked ("sent to a different email").
  - Logged out, logged in as Bob via `/login?redirect=/invite/{id}` → redirected back to the invite page → "Accept & join" → Bob is `member`.
  - Verified in Postgres directly: 3 memberships (1 owner, 2 members), 2 invites both `accepted_at` set, 3 `activity` rows (`workspace.created`, 2× `invite.created`, 2× `invite.accepted` — 5 total, matches every mutation).
- Found and fixed a real bug during this verification: the signup page's email field used `useState(invite.data?.email ?? "")`, which only reads `invite.data` once at mount (before the query resolves) — the invite email never actually prefilled. Fixed by deriving `email` from `invite.data?.email ?? emailInput` instead of syncing via state.

### M0.3 — CI: typecheck, lint, vitest, Drizzle migration check — done (2026-07-16)

Built:

- `.github/workflows/ci.yml`: single `ci` job on `push` (main) and `pull_request`, running `actions/checkout`, `pnpm/action-setup` (version resolved from the `packageManager` field, not pinned separately in the workflow), `actions/setup-node` (Node 20, pnpm cache), then `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` — followed by a two-part Drizzle migration check against a `postgres:16` service container: (1) schema-drift check — re-run `db:generate` and `git diff --exit-code` the `packages/db/drizzle` folder, so a schema edit without a matching migration file fails CI; (2) apply check — `pnpm db:migrate` against the fresh service-container Postgres, so a migration that doesn't actually apply cleanly fails CI too.

### Decisions

- **No separate `db:migrate:check` script** — reused the existing `db:generate`/`db:migrate` scripts directly in the workflow rather than adding new `packages/db` scripts, since CI is the only caller of this exact sequence (drift check via `git diff`, then a real apply). Simplest option consistent with not inventing scope beyond what M0.3 asks for.
- **Single job, not split by task.** Phase 0 has three small packages and one Postgres-backed check; splitting typecheck/lint/test/migration into parallel jobs would add matrix/service-container duplication for no real speedup at this repo size. Revisit if CI time becomes a problem later.
- **No Turborepo remote cache configured** — CI runs a cold `turbo run` every time (no `TURBO_TOKEN`/`TURBO_TEAM`). Fine at current size; add remote caching if CI time grows noticeably in later phases.

### Verified

- No GitHub remote is configured for this repo yet, so the workflow itself has not run on GitHub Actions. Verified every step locally instead, in the same order the workflow runs it: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` all pass (`pnpm check` green); `pnpm db:generate` against the current schema confirms "No schema changes, nothing to migrate" with a clean `git status` (the drift check would pass); brought up a fresh `postgres:16` container via `docker compose up -d postgres`, ran `pnpm db:migrate` against it, confirmed "migrations applied successfully!", then tore the container down.
- Phase 0 accept criteria (ROADMAP.md): "sign up → create workspace → invite user → both log in" was verified end-to-end in M0.2. "CI green" is satisfied in the sense that the CI workflow exists and every step it runs has been verified locally to pass — it will go green on GitHub the first time this repo is pushed to a GitHub remote, since none exists yet.
- **Addendum (2026-07-16, later same day):** remote added — `origin` now points at `https://github.com/Olsiii/canvas.git`, `main` pushed. The M0.3 CI workflow runs on GitHub from this point on; Phase 0 is fully closed out.
- **Addendum: both of the first two GitHub Actions runs failed** with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` during `pnpm install`. Root cause: `packageManager: "pnpm@11.0.9"` (package.json) requires Node ≥22.13, but `ci.yml` pinned `node-version: 20` (matching the then-current `engines.node: ">=20"`) — Node 20 doesn't have `node:sqlite`, which pnpm 11 needs internally. This never surfaced locally because the dev machine's Node is 24. Fixed by bumping `ci.yml` to `node-version: 22` and `engines.node` to `">=22.13"` so the two stay consistent with what pnpm actually requires.

## Phase 1 — Core work graph

### M1.1 — Hierarchy CRUD: spaces/folders/lists + sidebar navigation — done (2026-07-16)

Built:

- `packages/db/src/schema/hierarchy.ts`: `spaces`, `folders`, `lists` tables per DATA_MODEL.md, each with `order_key` (fractional index) and `deleted_at` (soft delete), plus `created_at`/`updated_at` per DATA_MODEL.md's stated global convention. Migration `0001_swift_peter_quill.sql` generated and applied.
- `packages/shared/src/schemas/hierarchy.ts`: zod schemas for create/update/delete on all three entities plus the `tree` query input.
- `apps/api/src/lib/order.ts`: `nextOrderKey(lastKey)` wrapping the `fractional-indexing` package's `generateKeyBetween`, per CLAUDE.md's hard rule. New dependency on `apps/api`. Unit tested.
- `apps/api/src/lib/membership.ts`: `getMembershipRole` extracted out of `workspace.ts` (M0.2) so `hierarchy.ts` can reuse it instead of duplicating the query.
- `apps/api/src/auth/can.ts`: extended `WorkspaceAction`/`MIN_ROLE` with `hierarchy:view` (guest+), `hierarchy:create`/`hierarchy:update` (member+), `hierarchy:delete` (admin+) — same `can()` function, no new resource type needed since hierarchy permissions are pure workspace-role checks (no per-space overrides until Phase 6). Unit tested.
- `apps/api/src/trpc/routers/hierarchy.ts`: `tree` query (returns flat `spaces`/`folders`/`lists` arrays for a workspace, assembled into a tree client-side) plus `space`/`folder`/`list` sub-routers each with `create`/`update`/`delete`. Every mutation writes an `activity` row. `space.delete` and `folder.delete` cascade the soft-delete to their children in a `db.transaction`.
- `apps/web/src/components/hierarchy-sidebar.tsx`: the sidebar tree — expand/collapse, inline create forms, inline rename, and an inline (non-blocking) delete-confirmation row instead of `window.confirm`.
- `apps/web/src/routes/workspace.$workspaceId.tsx` (shell: sidebar + `Outlet`), `workspace.$workspaceId.index.tsx` (empty state), `workspace.$workspaceId.list.$listId.tsx` (list stub page with breadcrumb — tasks land in M1.2). Dashboard's workspace rows now link to `/w/{workspaceId}`.

### Decisions

- **Cascading soft-delete for space/folder deletion.** DATA_MODEL.md gives each of spaces/folders/lists its own `deleted_at`, but doesn't specify delete cascade behavior. Leaving child folders/lists visible under a deleted space would be a worse default than cascading the soft-delete, so `space.delete` also soft-deletes its folders and lists (same transaction), and `folder.delete` soft-deletes its lists. Simplest option consistent with the soft-delete convention; noting it since it's not literally in the spec.
- **No optimistic updates in the sidebar** — CLAUDE.md lists optimistic updates under "UI conventions" (not "Hard rules"), and it matters most once lists hold thousands of rows (M1.3 task list), not a handful of spaces/folders/lists. Every hierarchy mutation here just invalidates `hierarchy.tree` on success, matching the plain invalidate-and-refetch pattern M0.2 already established in `workspaces.new.tsx`/`index.tsx`. Revisit for M1.3+ where render cost of a full refetch is higher.
- **`hierarchy:create`/`hierarchy:update` require `member`, `hierarchy:delete` requires `admin`.** Not specified in the spec; chosen so a regular member can build out the structure but accidental/malicious data loss needs an admin. Guests (rank 0) can view but not mutate, consistent with a "guest = view/comment" mental model.
- **No dedicated Playwright suite yet** — same gap noted (implicitly, by omission) in M0.1/M0.2: `test:e2e` has no task defined in any package yet. Followed the same precedent as M0.2 and verified the full CRUD + nav flow through a real browser instead (see Verified). Standing up Playwright is infrastructure, not hierarchy-CRUD scope — worth its own pass before M1.3's "at least one Playwright path" bar, but not invented here.

### Verified

- `pnpm check` (typecheck + lint + format:check) and `pnpm test` green across all four packages, including new unit tests: `order.test.ts` (fractional key generation/ordering) and three new `can.test.ts` cases (hierarchy view/create/delete role gating).
- Migration applied cleanly against the Docker Postgres.
- Full flow driven through a real browser: signed up a fresh user, created a workspace, opened it into the new `/w/{workspaceId}` shell, created a space ("Marketing"), created a folder inside it ("Q3 Campaigns"), created a list inside the folder ("Social Posts") — sidebar updated after each create. Clicked the list → list stub page rendered with the correct breadcrumb ("Marketing / Q3 Campaigns") and highlighted the active list in the sidebar. Renamed the list inline — updated instantly in both the sidebar and the page title. Deleted the folder via the inline confirm — folder and its list disappeared from the sidebar, and the still-open list detail page correctly switched to "This list doesn't exist (or was deleted)" instead of erroring.
- Verified directly in Postgres: `activity` has one row per mutation performed (`space.created`, `folder.created`, `folder.deleted`, `list.created`, `list.updated`); the deleted folder and list both have `deleted_at` set, the space does not.

### M1.2 — Tasks CRUD + custom statuses per list + fractional ordering — done (2026-07-16)

Built:

- `packages/db/src/schema/tasks.ts`: `statuses` (id, listId, name, color, kind, orderKey — no `deletedAt`, see Decisions) and `tasks` (id, listId, title, statusId, orderKey, createdBy, createdAt/updatedAt, deletedAt). Migration `0002_demonic_ronan.sql`. Deliberately a **narrower column set than DATA_MODEL.md's full `tasks` row** — no `description_json`, `priority`, `start_date`/`due_date`, `parent_task_id` yet, since ROADMAP.md explicitly assigns those to M1.5 (task detail panel) and M1.6 (subtasks). Adding them now would be pulling work forward from a later milestone; they land as additive migrations when their milestones start.
- `packages/shared`: `statuses.ts` (`STATUS_KINDS` — kept separate from `db`'s `pgEnum`, matching the existing pattern where `MEMBERSHIP_ROLES` and the `membership_role` pgEnum are two independently-declared literal arrays kept in sync by hand) and `schemas/tasks.ts` (create/update/delete/list schemas for both statuses and tasks).
- `apps/api/src/lib/`: extracted `assertCan` → `permissions.ts`, `requireSpace`/`requireList` → `hierarchy.ts`, `logActivity` → `activity.ts`, all out of `trpc/routers/hierarchy.ts` so the new `status`/`task` routers can reuse them instead of duplicating (`hierarchy.ts` now imports them back).
- `apps/api/src/trpc/routers/status.ts` and `task.ts`: mounted at `appRouter.status` / `appRouter.task` (siblings of `hierarchy`, not nested under it — statuses and tasks are their own top-level resources). `status.delete` is a **hard delete** (statuses have no `deletedAt`) blocked with `BAD_REQUEST` if any non-deleted task still references it — backed by the FK itself (`tasks.status_id` has no `onDelete` cascade, so Postgres would reject it even if the app-level check were skipped). `task.create` defaults to the list's first status (by `orderKey`) when no `statusId` is given; moving a task to a different status recomputes its `orderKey` by appending to the end of that status's column (per DATA_MODEL.md's `tasks(list_id, status_id, order_key)` index note — ordering is scoped to a list+status pair, i.e. a kanban column).
- `hierarchy.ts`'s `list.create` now seeds 3 default statuses ("To Do"/open, "In Progress"/active, "Done"/done) inside the same `db.transaction` as the list insert — necessary because `tasks.status_id` is `NOT NULL`, so a list needs at least one status to ever hold a task.
- `apps/api/src/auth/can.ts`: added `status:view/create/update/delete` and `task:view/create/update/delete`. `status:delete` requires `admin` (same reasoning as `hierarchy:delete` — deleting a column is higher blast-radius); `task:delete` only requires `member` (deleting one task is much lower-stakes than deleting a whole list/folder/space, so gating it at admin would be needless friction for day-to-day use).
- `apps/web/src/components/task-board.tsx`: a plain grouped-by-status board (status columns, inline add-task/add-status forms, inline non-blocking delete confirms, a `<select>` to move a task between statuses) — intentionally **not** the virtualized/sortable/filterable list view (M1.3) or the dnd-kit drag-and-drop kanban (M1.4); those are separate milestones. Wired into the list route (`workspace.$workspaceId.list.$listId.tsx`), replacing the M1.1 placeholder.

### Decisions

- **`tasks`/`statuses` schema deliberately excludes description/priority/dates/subtasks for now** — see above; the alternative (creating the full DATA_MODEL.md `tasks` row today with unused nullable columns) was rejected to keep this milestone's schema change scoped to what M1.2 actually uses, consistent with how M0.2 didn't create Phase-1 tables either. Migrations are cheap; scope creep isn't.
- **`statuses` has no `deletedAt` and uses a real `DELETE`, unlike every other Phase-1 entity so far.** DATA_MODEL.md's compact `statuses` row genuinely omits `deleted_at` (unlike `spaces`/`folders`/`lists`/`tasks`, which all list it explicitly) — read as intentional, not an omission, so statuses are hard-deleted. Blocked at both the app layer (clear error message) and the DB layer (FK with no cascade) if tasks still reference the status.
- **`task:delete` is `member`, `status:delete` is `admin`** — different blast radius for the two actions (see Built). Same underlying `can()` mechanism, just different `MIN_ROLE` entries; no new permission model needed.
- **No optimistic updates in the task board**, same reasoning as M1.1's sidebar — plain invalidate-on-success, revisit once M1.3's virtualized list view makes refetch cost matter.
- **No Playwright suite yet** — same standing gap as M1.1, verified via a real browser instead (see Verified).

### Verified

- `pnpm check` and `pnpm test` green across all packages; new unit tests: 3 `can.test.ts` cases for the `status:*`/`task:*` role tiers.
- Migration applied cleanly against the Docker Postgres; confirmed `tasks_status_id_statuses_id_fk` has `ON DELETE no action` (not cascade) in the generated SQL.
- Full flow driven through a real browser: created a new list and confirmed the 3 default statuses (To Do/In Progress/Done, correct colors and `kind`s) were seeded automatically. Created a task under "To Do", moved it to "In Progress" via the status dropdown (column counts updated live), deleted it via the inline confirm. Added a task to "Done", then tried to delete the "Done" status — correctly rejected with "Move or delete every task in this status before deleting it" and the status remained. Added a 4th custom status ("Blocked") via "+ Add status", then deleted it while empty — succeeded (hard delete, disappeared immediately).
- Found and fixed a real bug during this verification: the status delete-error message wasn't cleared when clicking "Cancel" on the confirm-delete prompt, so a stale error stuck around under an unrelated, later delete attempt. Fixed by clearing `deleteError` in the Cancel handler; reproduced the bug, applied the fix, then re-verified the fixed behavior live (not just by reasoning about the diff).
- Verified directly in Postgres: `activity` gained `status.created`/`status.deleted`/`task.created`/`task.updated`/`task.deleted` rows matching every mutation performed; the 3 seeded default statuses persist with correct `kind`s; the deleted task has `deleted_at` set, the surviving one does not.
