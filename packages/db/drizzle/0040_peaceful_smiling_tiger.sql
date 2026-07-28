CREATE TABLE "image_folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "image_folders" ADD CONSTRAINT "image_folders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_folders" ADD CONSTRAINT "image_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_folders_workspace_id_idx" ON "image_folders" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_folder_id_image_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."image_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_assets_folder_id_idx" ON "image_assets" USING btree ("folder_id");