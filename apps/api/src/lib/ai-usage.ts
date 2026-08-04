// Per-image cost, keyed by ImageEngine.provider — both are real, sourced
// estimates now that both adapters make live calls when their key is set
// (CLAUDE.md: "verify current model names/pricing at build time — this
// space moves monthly," so re-check both before relying on either in
// production). gemini-2.5-flash-image bills at Google's published
// $30/1M output tokens, and a generated image is a flat 1290 output tokens
// regardless of size — 1290/1_000_000 * 30 = $0.0387/image. gpt-image-1
// bills per output image token too, but at the "medium" quality OpenAI's
// own docs use as the default example, a single
// 1024x1024/1024x1536/1536x1024 image is ~$0.04 — used here as a flat
// per-image approximation since this adapter doesn't expose a quality
// parameter to vary the estimate by. Returns a string since Drizzle's
// `numeric` column type reads/writes strings, not floats (avoids float
// rounding on a money column).
const ESTIMATED_COST_PER_IMAGE_USD: Record<string, number> = {
  gemini: 0.0387,
  openai: 0.04,
};
const DEFAULT_ESTIMATED_COST_PER_IMAGE_USD = 0.02;

export function estimateImageCostUsd(provider: string, imageCount: number): string {
  const perImage = ESTIMATED_COST_PER_IMAGE_USD[provider] ?? DEFAULT_ESTIMATED_COST_PER_IMAGE_USD;
  return (imageCount * perImage).toFixed(4);
}

// Real per-token pricing, keyed by ChatClient.provider — more accurate than
// the image estimate above, but still an *estimate*: without reading the
// real API response's usage.input_tokens/output_tokens, token counts are
// approximated at ~4 chars/token (a standard rough-order-of-magnitude ratio
// for English text). "mock" has no real API behind it and is priced at
// whichever provider is currently primary (see brain/index.ts's
// getChatClient selection order) so the AI-quota system still exercises a
// realistic $ amount when no real key is configured locally.
const CHAT_RATES: Record<string, { inputUsdPerToken: number; outputUsdPerToken: number }> = {
  // Claude Opus 4.8 ($5/$25 per MTok, cached 2026-06-24).
  anthropic: { inputUsdPerToken: 5 / 1_000_000, outputUsdPerToken: 25 / 1_000_000 },
  // GPT-5.6 Sol ($5/$30 per MTok, standard context — verified via web
  // search at build time, GA 2026-07-09). Brain's current primary provider.
  openai: { inputUsdPerToken: 5 / 1_000_000, outputUsdPerToken: 30 / 1_000_000 },
};
const DEFAULT_CHAT_RATE = CHAT_RATES.openai!;
const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateChatCostUsd(
  provider: string,
  inputChars: number,
  outputChars: number,
): string {
  const rate = CHAT_RATES[provider] ?? DEFAULT_CHAT_RATE;
  const inputTokens = inputChars / CHARS_PER_TOKEN_ESTIMATE;
  const outputTokens = outputChars / CHARS_PER_TOKEN_ESTIMATE;
  return (inputTokens * rate.inputUsdPerToken + outputTokens * rate.outputUsdPerToken).toFixed(4);
}

// Rough placeholder (same caveat as ESTIMATED_COST_PER_IMAGE_USD above) —
// text-embedding-004-class models price roughly two orders of magnitude
// below chat-completion tokens; input-only, no output tokens to price.
const EMBEDDING_INPUT_USD_PER_TOKEN = 0.02 / 1_000_000;

export function estimateEmbedCostUsd(inputChars: number): string {
  const inputTokens = inputChars / CHARS_PER_TOKEN_ESTIMATE;
  return (inputTokens * EMBEDDING_INPUT_USD_PER_TOKEN).toFixed(4);
}
