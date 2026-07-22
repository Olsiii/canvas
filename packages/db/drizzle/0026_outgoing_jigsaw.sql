CREATE TYPE "public"."automation_run_status" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"automation_id" uuid NOT NULL,
	"status" "automation_run_status" NOT NULL,
	"log_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_json" jsonb NOT NULL,
	"conditions_json" jsonb NOT NULL,
	"actions_json" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;