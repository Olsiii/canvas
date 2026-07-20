CREATE TYPE "public"."ai_usage_kind" AS ENUM('generate', 'edit', 'chat', 'vision');--> statement-breakpoint
CREATE TYPE "public"."image_origin" AS ENUM('upload', 'generation');--> statement-breakpoint
CREATE TYPE "public"."image_version_source" AS ENUM('upload', 'generate', 'edit');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "ai_usage_kind" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"credits" integer NOT NULL,
	"cost_usd_est" numeric(10, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"origin" "image_origin" NOT NULL,
	"current_version_id" uuid,
	"alt_text" text,
	"tags_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "image_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"parent_version_id" uuid,
	"source" "image_version_source" NOT NULL,
	"prompt" text,
	"instruction" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"file_key" text NOT NULL,
	"thumb_key" text,
	"blurhash" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "image_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_current_version_id_image_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."image_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_versions" ADD CONSTRAINT "image_versions_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_versions" ADD CONSTRAINT "image_versions_parent_version_id_image_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."image_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_versions" ADD CONSTRAINT "image_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE no action ON UPDATE no action;