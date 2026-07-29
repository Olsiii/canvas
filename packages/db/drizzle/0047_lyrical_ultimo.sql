ALTER TABLE "brand_settings" ALTER COLUMN "image_provider" SET DEFAULT 'openai';
--> statement-breakpoint
-- 2026-07-29: OpenAI became the active default image provider (real
-- configured key + live adapter); existing brand kits still on the old
-- "gemini" default are moved to "openai" too, not just new ones. A brand
-- kit an owner explicitly chose "gemini" for by hand is indistinguishable
-- from one that was just never touched (this column has no separate
-- "explicitly set" flag), so this backfill is a best-effort default swap,
-- not a guarantee no one ever picked Gemini on purpose.
UPDATE "brand_settings" SET "image_provider" = 'openai' WHERE "image_provider" = 'gemini';