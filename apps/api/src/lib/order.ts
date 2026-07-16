import { generateKeyBetween } from "fractional-indexing";

/** Order key for a new item appended to the end of a list, given the current last key. */
export function nextOrderKey(lastKey: string | null): string {
  return generateKeyBetween(lastKey, null);
}
