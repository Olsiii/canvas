DROP INDEX "brain_conversations_task_uniq";--> statement-breakpoint
DROP INDEX "brain_conversations_global_uniq";--> statement-breakpoint
ALTER TABLE "brain_conversations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "brain_conversations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "brain_conversations_history_idx" ON "brain_conversations" USING btree ("workspace_id","created_by","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brain_conversations_task_uniq" ON "brain_conversations" USING btree ("workspace_id","context_id","created_by") WHERE "brain_conversations"."context_type" != 'global' and "brain_conversations"."is_active" and "brain_conversations"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "brain_conversations_global_uniq" ON "brain_conversations" USING btree ("workspace_id","created_by") WHERE "brain_conversations"."context_type" = 'global' and "brain_conversations"."is_active" and "brain_conversations"."deleted_at" is null;