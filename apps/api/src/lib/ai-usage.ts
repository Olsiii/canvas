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
