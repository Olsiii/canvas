-- Custom roles move from per-workspace to account-level (owned by their
-- creator, usable in any workspace that creator belongs to — see
-- PROGRESS.md's 2026-07-28 decision). There's no way to backfill a
-- "creator" for existing rows (the column never existed), so — same
-- precedent as the ClickUp-importer cleanup migration — these are dropped
-- rather than left with a fabricated owner. Custom-role assignments
-- (memberships.custom_role_id) referencing a deleted role are already
-- handled by that column's own `onDelete: set null`.
DELETE FROM "public"."custom_roles";--> statement-breakpoint
ALTER TABLE "public"."custom_roles" DROP CONSTRAINT "custom_roles_workspace_id_name_unique";--> statement-breakpoint
ALTER TABLE "public"."custom_roles" DROP CONSTRAINT "custom_roles_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "public"."custom_roles" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "public"."custom_roles" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."custom_roles" ADD CONSTRAINT "custom_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."custom_roles" ADD CONSTRAINT "custom_roles_created_by_name_unique" UNIQUE("created_by","name");
