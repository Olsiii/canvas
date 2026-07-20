import { describe, expect, it } from "vitest";
import { estimateImageCostUsd } from "./ai-usage";

describe("estimateImageCostUsd", () => {
  it("scales linearly with image count", () => {
    expect(estimateImageCostUsd(1)).toBe("0.0200");
    expect(estimateImageCostUsd(3)).toBe("0.0600");
  });

  it("returns a fixed 4-decimal string, not a float", () => {
    expect(typeof estimateImageCostUsd(1)).toBe("string");
  });
});
