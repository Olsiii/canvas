/** Soft caps for Brain + image generation (per user). Enforced in the API. */
export const AI_BRAIN_MESSAGES_PER_DAY = 50;
export const AI_IMAGE_GENERATIONS_PER_DAY = 20;
/**
 * Estimated USD from ai_usage.cost_usd_est, calendar month UTC — a single
 * app-wide total shared by every user in every workspace, not per-user
 * (2026-07-29 decision, see PROGRESS.md: start with one simple shared
 * ceiling, split it out per-workspace later if that turns out to matter).
 * The per-user daily counts above still apply on top of this, so one user
 * can't burn through the whole shared budget in a single day.
 */
export const AI_COST_USD_PER_MONTH_TOTAL = 50;
