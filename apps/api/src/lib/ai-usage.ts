// Rough placeholder, not sourced from real Gemini pricing (no live API
// access in this environment) — CLAUDE.md: "Verify current model
// names/pricing at build time — this space moves monthly." Revisit once
// the adapter makes real calls. Returns a string since Drizzle's `numeric`
// column type reads/writes strings, not floats (avoids float rounding on a
// money column).
const ESTIMATED_COST_PER_IMAGE_USD = 0.02;

export function estimateImageCostUsd(imageCount: number): string {
  return (imageCount * ESTIMATED_COST_PER_IMAGE_USD).toFixed(4);
}

// Real Claude Opus 4.8 pricing ($5/$25 per MTok, cached 2026-06-24) — more
// accurate than the image estimate above, but still an *estimate*: without
// a live API call there's no real `usage.input_tokens`/`output_tokens` to
// read, so token counts are approximated at ~4 chars/token (a standard
// rough-order-of-magnitude ratio for English text). Also used, honestly,
// when MockChatClient ran instead of the real one — the "cost" is real
// per-token pricing applied to whatever text length was actually produced.
const OPUS_INPUT_USD_PER_TOKEN = 5 / 1_000_000;
const OPUS_OUTPUT_USD_PER_TOKEN = 25 / 1_000_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateChatCostUsd(inputChars: number, outputChars: number): string {
  const inputTokens = inputChars / CHARS_PER_TOKEN_ESTIMATE;
  const outputTokens = outputChars / CHARS_PER_TOKEN_ESTIMATE;
  return (
    inputTokens * OPUS_INPUT_USD_PER_TOKEN +
    outputTokens * OPUS_OUTPUT_USD_PER_TOKEN
  ).toFixed(4);
}
