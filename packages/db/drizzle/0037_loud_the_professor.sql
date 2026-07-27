ALTER TABLE "brand_settings" DROP CONSTRAINT "brand_settings_workspace_id_unique";--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "brand_kit_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "name" text DEFAULT 'Default' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_brand_kit_id_brand_settings_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_settings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Every existing row was a workspace's sole brand config (unique constraint
-- just dropped above enforced that) — mark them all as their workspace's
-- default kit so existing generation/Brain behavior is unchanged.
UPDATE "brand_settings" SET "is_default" = true;