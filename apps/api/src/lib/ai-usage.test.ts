import { describe, expect, it } from "vitest";
import { estimateChatCostUsd, estimateImageCostUsd } from "./ai-usage";

describe("estimateImageCostUsd", () => {
  it("scales linearly with image count", () => {
    expect(estimateImageCostUsd(1)).toBe("0.0200");
    expect(estimateImageCostUsd(3)).toBe("0.0600");
  });

  it("returns a fixed 4-decimal string, not a float", () => {
    expect(typeof estimateImageCostUsd(1)).toBe("string");
  });
});

describe("estimateChatCostUsd", () => {
  it("prices input and output tokens at real Opus 4.8 rates ($5/$25 per MTok)", () => {
    // 4000 chars ~= 1000 tokens each way: 1000*5/1e6 + 1000*25/1e6 = 0.03
    expect(estimateChatCostUsd(4000, 4000)).toBe("0.0300");
  });

  it("charges output-only when there's no input (e.g. a mock reply)", () => {
    expect(estimateChatCostUsd(0, 400)).toBe("0.0025");
  });

  it("returns a fixed 4-decimal string, not a float", () => {
    expect(typeof estimateChatCostUsd(100, 100)).toBe("string");
  });
});
