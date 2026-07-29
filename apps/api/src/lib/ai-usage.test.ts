import { describe, expect, it } from "vitest";
import { estimateChatCostUsd, estimateImageCostUsd } from "./ai-usage";

describe("estimateImageCostUsd", () => {
  it("scales linearly with image count, per provider", () => {
    expect(estimateImageCostUsd("gemini", 1)).toBe("0.0200");
    expect(estimateImageCostUsd("gemini", 3)).toBe("0.0600");
    expect(estimateImageCostUsd("openai", 1)).toBe("0.0400");
    expect(estimateImageCostUsd("openai", 3)).toBe("0.1200");
  });

  it("falls back to the default per-image rate for an unknown provider", () => {
    expect(estimateImageCostUsd("unknown", 1)).toBe("0.0200");
  });

  it("returns a fixed 4-decimal string, not a float", () => {
    expect(typeof estimateImageCostUsd("gemini", 1)).toBe("string");
  });
});

describe("estimateChatCostUsd", () => {
  it("prices input and output tokens at real Opus 4.8 rates for anthropic ($5/$25 per MTok)", () => {
    // 4000 chars ~= 1000 tokens each way: 1000*5/1e6 + 1000*25/1e6 = 0.03
    expect(estimateChatCostUsd("anthropic", 4000, 4000)).toBe("0.0300");
  });

  it("prices input and output tokens at real gpt-5.6 rates for openai ($5/$30 per MTok)", () => {
    // 1000*5/1e6 + 1000*30/1e6 = 0.035
    expect(estimateChatCostUsd("openai", 4000, 4000)).toBe("0.0350");
  });

  it("falls back to the openai rate for an unknown provider (e.g. mock)", () => {
    expect(estimateChatCostUsd("mock", 4000, 4000)).toBe("0.0350");
    expect(estimateChatCostUsd("unknown", 4000, 4000)).toBe("0.0350");
  });

  it("charges output-only when there's no input (e.g. a mock reply)", () => {
    expect(estimateChatCostUsd("anthropic", 0, 400)).toBe("0.0025");
  });

  it("returns a fixed 4-decimal string, not a float", () => {
    expect(typeof estimateChatCostUsd("anthropic", 100, 100)).toBe("string");
  });
});
