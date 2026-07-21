import { describe, expect, it } from "vitest";
import { presetToRRule, RECURRENCE_PRESETS } from "./recurrence";

describe("presetToRRule", () => {
  it("maps every preset to a valid-looking RRULE string", () => {
    for (const preset of RECURRENCE_PRESETS) {
      expect(presetToRRule(preset)).toMatch(/^FREQ=/);
    }
  });

  it("maps weekdays to a Monday-Friday BYDAY rule", () => {
    expect(presetToRRule("weekdays")).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });
});
