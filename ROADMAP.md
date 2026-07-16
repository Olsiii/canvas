# ROADMAP.md — build order for Claude Code

Rule: **do not start a phase until the previous phase's acceptance criteria pass.** Each milestone is sized to be one focused Claude Code session (or a few). Estimates assume you reviewing/steering, Claude Code writing most code.

## Phase 0 — Foundation (~2–3 sessions)
- M0.1 Monorepo scaffold: pnpm + Turborepo, `apps/web`, `apps/api`, `packages/db`, `packages/shared`. Docker Compose: Postgres, Redis, MinIO.
- M0.2 Auth: email/password + Google OAuth, sessions, workspace creation, invites, roles.
- M0.3 CI: typecheck, lint, vitest, drizzle migration check.
- ✅ Accept: sign up → create workspace → invite user → both log in. CI green.

## Phase 1 — Core work graph (~8–12 sessions)
- M1.1 Hierarchy CRUD: spaces/folders/lists + sidebar navigation.
- M1.2 Tasks CRUD + custom statuses per list + fractional ordering.
- M1.3 List view (virtualized table, inline edit) with sort/filter/group.
- M1.4 Kanban board (dnd-kit drag across status columns).
- M1.5 Task detail panel: rich text description (TipTap), assignees, dates, priority.
- M1.6 Subtasks + checklists.
- M1.7 Comments + @mentions + reactions; activity log; in-app notifications.
- M1.8 Tags + custom fields (all 9 types incl. image).
- M1.9 Attachments (upload to S3, image thumbs + lightbox).
- M1.10 Basic search (Postgres FTS) + WS invalidation realtime.
- ✅ Accept: two users collaborate live on a board; Playwright smoke passes; 5k-task list renders p95 < 200ms.

## Phase 2 — Image Brain (~6–10 sessions) ← the differentiator
- M2.1 ImageEngine interface + first adapter (Gemini image) behind BullMQ worker; `image_assets`/`image_versions` tables; metering.
- M2.2 Brain chat panel (global + per-task), streaming, persisted conversations.
- M2.3 Claude tool-use orchestration: `generate_image`, `edit_image`, `attach_to_task`, `summarize_thread`.
- M2.4 Generation UX: prompt box, aspect/style presets, brand palette from `brand_settings`, n-variants grid.
- M2.5 **Iterative editing loop**: select version → natural-language edit → new child version; live status (queued/generating/done).
- M2.6 Version tree UI: tree sidebar, side-by-side compare, revert/promote, branch.
- M2.7 Second adapter (gpt-image-1) + per-workspace provider config; image understanding (alt-text, auto-tags via Claude vision).
- ✅ Accept: prompt → generate → 3 conversational edits → attach to task in < 60s; version tree correct after branching; usage rows recorded.

## Phase 3 — Views & workflow depth (~8–10 sessions)
- M3.1 Calendar view. M3.2 Table view (spreadsheet-ish bulk edit). M3.3 Gantt/timeline with dependency arrows.
- M3.4 Dependencies + milestones. M3.5 Recurring tasks + reminders. M3.6 Task templates.
- M3.7 Time tracking (timer + manual) + timesheet view. M3.8 Workload view. M3.9 Email notifications digest.
- ✅ Accept: dependency chains render on Gantt; recurring task spawns correctly; timesheet totals match entries.

## Phase 4 — Docs, Chat, Proofing (~10–14 sessions)
- M4.1 Docs with Yjs CRDT collaborative editing (TipTap + y-websocket).
- M4.2 Doc ↔ task linking; Brain in docs (incl. inline image generation).
- M4.3 Chat channels + threads; Brain in chat.
- M4.4 **Image proofing**: pin comments to image regions (`annotations`); AI critique ("what would you improve?") — pairs with version tree.
- M4.5 Forms → task intake. M4.6 Clips (video upload + player).
- ✅ Accept: two cursors editing one doc; annotation pins survive version switch (per-version anchoring).

## Phase 5 — Automation & platform (~8–12 sessions)
- M5.1 Automations engine (trigger/condition/action) + run log. Actions include `generate_image`.
- M5.2 Dashboards + widgets (task counts, burndown, time, AI usage/cost).
- M5.3 Goals/OKRs linked to tasks.
- M5.4 Public REST API v1 + API keys + rate limits; webhooks.
- M5.5 Importers: ClickUp (API), Trello/Asana (CSV). M5.6 Integrations: Slack notify, Google Drive picker, GitHub PR links.
- ✅ Accept: "when status → Done, post to Slack" works; ClickUp import brings a real workspace across.

## Phase 6 — Enterprise & polish (~ongoing)
- SAML SSO + SCIM; custom roles + per-space permission overrides; audit log UI.
- Semantic + visual search (pgvector: text embeddings + image embeddings — "find images like this").
- PWA/mobile pass; Tauri desktop wrapper; data export; performance hardening.

## Sizing reality check
Phases 0–2 ≈ 6–8 weeks part-time — that's your usable product. Phases 3–5 ≈ 3–4 months more. Phase 6 as needed. "All ClickUp features" at enterprise polish is a multi-year surface — the phase gates keep you shipping something real the whole way.
