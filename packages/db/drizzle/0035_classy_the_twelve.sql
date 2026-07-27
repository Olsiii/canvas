CREATE INDEX "activity_workspace_id_idx" ON "activity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "folders_space_id_idx" ON "folders" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "lists_space_id_idx" ON "lists" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "lists_folder_id_idx" ON "lists" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "spaces_workspace_id_idx" ON "spaces" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "statuses_list_id_idx" ON "statuses" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "tasks_list_id_idx" ON "tasks" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "tasks_status_id_idx" ON "tasks" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_id_idx" ON "checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "checklists_task_id_idx" ON "checklists" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "comments_task_id_idx" ON "comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "custom_field_defs_workspace_id_idx" ON "custom_field_defs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "custom_field_values_task_id_idx" ON "custom_field_values" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "ai_usage_workspace_id_idx" ON "ai_usage" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "image_assets_workspace_id_idx" ON "image_assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "image_versions_asset_id_idx" ON "image_versions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "attachments_task_id_idx" ON "attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "recurrence_rules_next_run_at_idx" ON "recurrence_rules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("remind_at") WHERE "reminders"."done_at" is null;--> statement-breakpoint
CREATE INDEX "reminders_user_due_idx" ON "reminders" USING btree ("user_id","remind_at") WHERE "reminders"."done_at" is null;--> statement-breakpoint
CREATE INDEX "time_entries_task_id_idx" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entries_user_id_idx" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doc_task_links_task_id_idx" ON "doc_task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "docs_workspace_id_idx" ON "docs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "channels_workspace_id_idx" ON "channels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "messages_channel_id_idx" ON "messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "embeddings_workspace_id_entity_type_idx" ON "embeddings" USING btree ("workspace_id","entity_type");