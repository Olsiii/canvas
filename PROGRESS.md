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
- M0.2: auth (email/password + Google OAuth), sessions, workspace creation, invites, roles — this is where `packages/db/src/schema` actually gets its first tables (`users`, `sessions`, `workspaces`, `memberships`).
- M0.3: CI (typecheck + lint + vitest + drizzle migration check on every push).
