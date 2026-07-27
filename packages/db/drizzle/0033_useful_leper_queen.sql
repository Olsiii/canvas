CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_role" "membership_role" NOT NULL,
	"grants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revokes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "custom_roles_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "space_permission_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"principal" text NOT NULL,
	"action" text NOT NULL,
	"allow" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_permission_overrides_space_id_principal_action_unique" UNIQUE("space_id","principal","action")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "custom_role_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_permission_overrides" ADD CONSTRAINT "space_permission_overrides_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_custom_role_id_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE set null ON UPDATE no action;