import { describe, expect, it } from "vitest";
import {
  AI_BRAIN_MESSAGES_PER_DAY,
  AI_COST_USD_PER_MONTH_TOTAL,
  AI_IMAGE_GENERATIONS_PER_DAY,
} from "@canvas/shared";

describe("AI quota defaults", () => {
  it("matches the agreed staff defaults", () => {
    expect(AI_BRAIN_MESSAGES_PER_DAY).toBe(50);
    expect(AI_IMAGE_GENERATIONS_PER_DAY).toBe(20);
    expect(AI_COST_USD_PER_MONTH_TOTAL).toBe(50);
  });
});
