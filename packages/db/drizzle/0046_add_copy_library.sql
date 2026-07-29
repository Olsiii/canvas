CREATE TYPE "public"."folder_kind" AS ENUM('custom', 'copy_root', 'copy_client');--> statement-breakpoint
CREATE TABLE "library_copy_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"folder_id" uuid,
	"brand_kit_id" uuid,
	"source_generation_id" uuid,
	"thumbnail_attachment_id" uuid,
	"label" text NOT NULL,
	"copy_type" text NOT NULL,
	"length" "copy_length" NOT NULL,
	"language" "copy_language" NOT NULL,
	"text" text,
	"design_copy" text,
	"caption" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "image_folders" ADD COLUMN "parent_folder_id" uuid;--> statement-breakpoint
ALTER TABLE "image_folders" ADD COLUMN "kind" "folder_kind" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "image_folders" ADD COLUMN "brand_kit_id" uuid;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_folder_id_image_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."image_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_brand_kit_id_brand_settings_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_settings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_source_generation_id_copy_generations_id_fk" FOREIGN KEY ("source_generation_id") REFERENCES "public"."copy_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_thumbnail_attachment_id_attachments_id_fk" FOREIGN KEY ("thumbnail_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_copy_items" ADD CONSTRAINT "library_copy_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_copy_items_folder_id_idx" ON "library_copy_items" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "library_copy_items_workspace_id_idx" ON "library_copy_items" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "image_folders" ADD CONSTRAINT "image_folders_parent_folder_id_image_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."image_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_folders" ADD CONSTRAINT "image_folders_brand_kit_id_brand_settings_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_settings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_folders_parent_folder_id_idx" ON "image_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_folders_copy_root_uniq" ON "image_folders" USING btree ("workspace_id") WHERE "image_folders"."kind" = 'copy_root' and "image_folders"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "image_folders_copy_client_uniq" ON "image_folders" USING btree ("workspace_id","brand_kit_id") WHERE "image_folders"."kind" = 'copy_client' and "image_folders"."deleted_at" is null;