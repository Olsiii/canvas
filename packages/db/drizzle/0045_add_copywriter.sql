CREATE TYPE "public"."copy_language" AS ENUM('sq', 'en', 'both');--> statement-breakpoint
CREATE TYPE "public"."copy_generation_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."copy_length" AS ENUM('short', 'medium', 'long');--> statement-breakpoint
CREATE TABLE "copy_generations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand_kit_id" uuid NOT NULL,
	"created_by" uuid,
	"source_attachment_id" uuid,
	"copy_type" text NOT NULL,
	"length" "copy_length" NOT NULL,
	"language" "copy_language" NOT NULL,
	"status" "copy_generation_status" DEFAULT 'pending' NOT NULL,
	"design_read" text,
	"variants_json" jsonb,
	"approved_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "fonts" text;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD COLUMN "default_copy_language" "copy_language" DEFAULT 'sq' NOT NULL;--> statement-breakpoint
ALTER TABLE "copy_generations" ADD CONSTRAINT "copy_generations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_generations" ADD CONSTRAINT "copy_generations_brand_kit_id_brand_settings_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_generations" ADD CONSTRAINT "copy_generations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_generations" ADD CONSTRAINT "copy_generations_source_attachment_id_attachments_id_fk" FOREIGN KEY ("source_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copy_generations_brand_kit_id_idx" ON "copy_generations" USING btree ("brand_kit_id");--> statement-breakpoint
CREATE INDEX "copy_generations_workspace_id_idx" ON "copy_generations" USING btree ("workspace_id");