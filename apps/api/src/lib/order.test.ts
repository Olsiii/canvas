import { describe, expect, it } from "vitest";
import { nextOrderKey } from "./order";

describe("nextOrderKey", () => {
  it("generates a key for the first item in an empty list", () => {
    expect(nextOrderKey(null)).toBeTruthy();
  });

  it("generates keys that sort after the previous key", () => {
    const first = nextOrderKey(null);
    const second = nextOrderKey(first);
    const third = nextOrderKey(second);
    expect([first, second, third]).toEqual([first, second, third].slice().sort());
  });
});
