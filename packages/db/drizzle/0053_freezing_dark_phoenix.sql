CREATE INDEX "forms_workspace_id_idx" ON "forms" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "automation_runs_automation_id_idx" ON "automation_runs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "automations_workspace_id_idx" ON "automations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "goals_workspace_id_idx" ON "goals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhooks_workspace_id_idx" ON "webhooks" USING btree ("workspace_id");