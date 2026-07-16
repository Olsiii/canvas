import { describe, expect, it } from "vitest";
import { appRouter } from "./router";

describe("appRouter", () => {
  it("reports healthy", async () => {
    const caller = appRouter.createCaller({} as never);
    await expect(caller.health()).resolves.toEqual({ ok: true });
  });
});
