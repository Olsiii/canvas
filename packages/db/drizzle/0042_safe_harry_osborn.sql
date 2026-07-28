-- The ClickUp importer is being removed entirely (not just relabeled) —
-- these rows carry no payload (see imports.ts's old comment: a ClickUp
-- import's token was never persisted) and are meaningless without the
-- feature, so they're dropped rather than left orphaned pointing at an
-- enum value about to stop existing.
DELETE FROM "public"."imports" WHERE "source" = 'clickup_api';--> statement-breakpoint
ALTER TABLE "public"."imports" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."import_source";--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('csv');--> statement-breakpoint
ALTER TABLE "public"."imports" ALTER COLUMN "source" SET DATA TYPE "public"."import_source" USING "source"::"public"."import_source";