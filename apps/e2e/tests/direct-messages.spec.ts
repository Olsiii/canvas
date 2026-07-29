import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, inviteAndGetLink, signUp } from "./helpers";

test("direct messages: starting a DM, replying live, no duplicate thread, and staying out of Channels", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Ada Owner");
  await createWorkspaceAndOpen(page, "DM Workspace");

  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = `bob-dm-${Date.now()}@example.com`;
  const inviteLink = await inviteAndGetLink(page, bobEmail);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signUp(bobPage, "Bob Member", bobEmail);
  await bobPage.goto(inviteLink);
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  await expect(bobPage.getByRole("link", { name: "Open" })).toBeVisible();

  // Ada starts a DM with Bob and sends a message.
  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByTestId("chat-new-dm").click();
  await page.getByTestId("chat-new-dm-select").selectOption({ label: "Bob Member" });
  const started = page.waitForResponse((res) => res.url().includes("dm.startOrGet"));
  await page.getByTestId("chat-start-dm").click();
  await started;
  await expect(page.getByTestId("chat-dm-page")).toBeVisible({ timeout: 15_000 });

  const adaComposer = page.getByTestId("message-composer");
  await adaComposer.click();
  await page.keyboard.type("Hi Bob, got a sec?");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("channel-messages").getByText("Hi Bob, got a sec?")).toBeVisible();

  // Bob sees the DM under his own Direct Messages list, opens it, sees
  // Ada's message, replies.
  await bobPage.getByRole("link", { name: "Open" }).click();
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await bobPage.reload();
  await bobPage.getByRole("link", { name: "Ada Owner" }).click();
  await expect(bobPage.getByTestId("chat-dm-page")).toBeVisible();
  await expect(
    bobPage.getByTestId("channel-messages").getByText("Hi Bob, got a sec?"),
  ).toBeVisible();

  const bobComposer = bobPage.getByTestId("message-composer");
  await bobComposer.click();
  await bobPage.keyboard.type("Sure, what's up?");
  await bobPage.getByTestId("message-send").click();
  await expect(bobPage.getByTestId("channel-messages").getByText("Sure, what's up?")).toBeVisible();

  // Ada's still-open tab shows Bob's reply live — no reload needed.
  await expect(page.getByTestId("channel-messages").getByText("Sure, what's up?")).toBeVisible({
    timeout: 15_000,
  });

  // Starting a DM with Bob again lands on the same thread, not a new one.
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByTestId("chat-new-dm").click();
  await page.getByTestId("chat-new-dm-select").selectOption({ label: "Bob Member" });
  const startedAgain = page.waitForResponse((res) => res.url().includes("dm.startOrGet"));
  await page.getByTestId("chat-start-dm").click();
  await startedAgain;
  await expect(page.getByTestId("chat-dm-page")).toBeVisible();
  await expect(page.getByTestId("channel-messages").getByText("Hi Bob, got a sec?")).toBeVisible();

  // The DM never shows up in either user's regular Channels list — neither
  // user has created or joined an actual channel, so it should still read
  // as empty rather than showing the DM channel row.
  await expect(page.getByText("No channels yet — create one to start chatting.")).toBeVisible();
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(bobPage.getByText("No channels yet — create one to start chatting.")).toBeVisible();

  await bobContext.close();
});
