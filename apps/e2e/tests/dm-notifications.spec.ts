import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, inviteAndGetLink, signUp } from "./helpers";

// Stubs Web Audio before any app code loads, so `playDmChime()`
// (apps/web/src/lib/dm-sound.ts) runs its real code path but we can count
// how many oscillators it actually started instead of trying to detect
// real sound output in a headless browser.
const STUB_AUDIO_CONTEXT = () => {
  class FakeOscillator {
    type = "sine";
    frequency = { value: 0 };
    connect() {}
    start() {
      const w = window as unknown as { __dmChimeStarts?: number };
      w.__dmChimeStarts = (w.__dmChimeStarts ?? 0) + 1;
    }
    stop() {}
  }
  class FakeGain {
    gain = {
      setValueAtTime() {},
      linearRampToValueAtTime() {},
    };
    connect() {}
  }
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    createOscillator() {
      return new FakeOscillator();
    }
    createGain() {
      return new FakeGain();
    }
    resume() {
      return Promise.resolve();
    }
  }
  Object.assign(window, { AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext });
};

async function chimeCount(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => (window as unknown as { __dmChimeStarts?: number }).__dmChimeStarts ?? 0,
  );
}

test("DM notifications: bottom-right toast + chime when not viewing the thread, quiet/toast-free when viewing it, toast survives muting", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Ada Owner");
  await createWorkspaceAndOpen(page, "DM Notifications Workspace");

  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = `bob-dm-notify-${Date.now()}@example.com`;
  const inviteLink = await inviteAndGetLink(page, bobEmail);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await bobPage.addInitScript(STUB_AUDIO_CONTEXT);
  await signUp(bobPage, "Bob Member", bobEmail);
  await bobPage.goto(inviteLink);
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  await expect(bobPage.getByRole("link", { name: "Open" })).toBeVisible();

  // Ada starts a DM with Bob (this is what creates the channel + adds Bob
  // as a member — no message needs to be sent yet for the notification
  // feature's membership check to matter).
  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByTestId("chat-new-dm").click();
  await page.getByTestId("chat-new-dm-select").selectOption({ label: "Bob Member" });
  const started = page.waitForResponse((res) => res.url().includes("dm.startOrGet"));
  await page.getByTestId("chat-start-dm").click();
  await started;
  await expect(page.getByTestId("chat-dm-page")).toBeVisible({ timeout: 15_000 });

  // Bob opens the workspace but stays on the home page, not the DM thread.
  await bobPage.getByRole("link", { name: "Open" }).click();
  await expect(bobPage).not.toHaveURL(/\/chat\/dm\//);

  // Ada sends a message — Bob isn't looking at the thread, so it should
  // chime and show the bottom-right toast with the sender's name + preview.
  const adaComposer = page.getByTestId("message-composer");
  await adaComposer.click();
  await page.keyboard.type("Hi Bob, got a sec?");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("channel-messages").getByText("Hi Bob, got a sec?")).toBeVisible();

  await expect.poll(() => chimeCount(bobPage), { timeout: 10_000 }).toBeGreaterThan(0);
  const toast = bobPage.locator('[data-testid^="dm-toast-"]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Ada Owner");
  await expect(toast).toContainText("Hi Bob, got a sec?");

  // Clicking the toast navigates straight to the thread.
  await toast.click();
  await expect(bobPage.getByTestId("chat-dm-page")).toBeVisible();
  await expect(toast).toHaveCount(0);

  // Further messages while Bob is looking at the thread shouldn't chime or toast.
  await bobPage.evaluate(() => {
    (window as unknown as { __dmChimeStarts?: number }).__dmChimeStarts = 0;
  });
  await adaComposer.click();
  await page.keyboard.type("Still there?");
  await page.getByTestId("message-send").click();
  await expect(bobPage.getByTestId("channel-messages").getByText("Still there?")).toBeVisible({
    timeout: 15_000,
  });
  expect(await chimeCount(bobPage)).toBe(0);
  await expect(toast).toHaveCount(0);

  // Bob mutes the sound, then navigates away — the toast should still show
  // (it's independent of the sound toggle), but no chime.
  await bobPage.getByTestId("chat-dm-sound-toggle").click();
  await expect(bobPage.getByTestId("chat-dm-sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(bobPage).not.toHaveURL(/\/chat\/dm\//);

  await adaComposer.click();
  await page.keyboard.type("One more thing");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("channel-messages").getByText("One more thing")).toBeVisible();

  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(toast).toContainText("One more thing");
  expect(await chimeCount(bobPage)).toBe(0);

  await bobContext.close();
});
