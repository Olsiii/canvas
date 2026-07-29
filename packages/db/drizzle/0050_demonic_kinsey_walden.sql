ALTER TABLE "channels" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "is_dm" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "dm_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_dm_pair_uniq" ON "channels" USING btree ("workspace_id","dm_key") WHERE "channels"."is_dm" and "channels"."dm_key" is not null;