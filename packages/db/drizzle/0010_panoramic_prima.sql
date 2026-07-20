CREATE TYPE "public"."brain_context_type" AS ENUM('task', 'doc', 'channel', 'global');--> statement-breakpoint
CREATE TYPE "public"."brain_message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TABLE "brain_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"context_type" "brain_context_type" NOT NULL,
	"context_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "brain_message_role" NOT NULL,
	"content_json" jsonb NOT NULL,
	"image_version_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brain_conversations" ADD CONSTRAINT "brain_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_conversations" ADD CONSTRAINT "brain_conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_messages" ADD CONSTRAINT "brain_messages_conversation_id_brain_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."brain_conversations"("id") ON DELETE cascade ON UPDATE no action;