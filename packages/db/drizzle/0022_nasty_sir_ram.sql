CREATE TABLE "doc_task_links" (
	"doc_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_task_links_doc_id_task_id_pk" PRIMARY KEY("doc_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "doc_task_links" ADD CONSTRAINT "doc_task_links_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_task_links" ADD CONSTRAINT "doc_task_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;