CREATE TABLE "brand_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"palette_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" text,
	"logo_asset_id" uuid,
	"guidelines" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_settings_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_settings" ADD CONSTRAINT "brand_settings_logo_asset_id_image_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;