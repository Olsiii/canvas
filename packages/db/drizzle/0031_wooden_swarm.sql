CREATE TYPE "public"."attachment_source" AS ENUM('upload', 'google_drive');--> statement-breakpoint
CREATE TYPE "public"."task_pr_link_state" AS ENUM('open', 'closed', 'merged', 'unknown');--> statement-breakpoint
CREATE TABLE "task_pr_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"url" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"title" text,
	"state" "task_pr_link_state" DEFAULT 'unknown' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "file_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "source" "attachment_source" DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "task_pr_links" ADD CONSTRAINT "task_pr_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_pr_links" ADD CONSTRAINT "task_pr_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;