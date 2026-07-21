CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"image_version_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"w" double precision,
	"h" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_image_version_id_image_versions_id_fk" FOREIGN KEY ("image_version_id") REFERENCES "public"."image_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;