CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TYPE "public"."ai_usage_kind" ADD VALUE 'embed';--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"model" text NOT NULL,
	"vector" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embeddings_entity_type_entity_id_unique" UNIQUE("entity_type","entity_id")
);
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;