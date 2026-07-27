import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, inviteAndGetLink, signUp } from "./helpers";

test("private channel: adding a member lets them see it, removing them takes it away again", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Ada Owner");
  await createWorkspaceAndOpen(page, "Private Channel Workspace");

  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = `bob-private-chat-${Date.now()}@example.com`;
  const inviteLink = await inviteAndGetLink(page, bobEmail);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signUp(bobPage, "Bob Member", bobEmail);
  await bobPage.goto(inviteLink);
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  await expect(bobPage.getByRole("link", { name: "Open" })).toBeVisible();

  // Ada creates a private channel — only she is a member so far.
  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByTestId("chat-new-channel-name").fill("secrets");
  await page.getByTestId("chat-new-channel-private").check();
  await page.getByTestId("chat-create-channel").click();
  await expect(page.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });

  // Bob can't see the private channel in his channel list yet.
  await bobPage.getByRole("link", { name: "Open" }).click();
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(bobPage.getByRole("link", { name: "secrets" })).not.toBeVisible();

  // Ada opens Members and adds Bob.
  await page.getByTestId("channel-members").click();
  const panel = page.getByTestId("channel-members-panel");
  await expect(panel.getByText("Ada Owner")).toBeVisible();
  await panel.getByLabel("Add a member").selectOption({ label: "Bob Member" });
  const added = page.waitForResponse((res) => res.url().includes("members.add"));
  await panel.getByTestId("channel-member-add").click();
  await added;
  await expect(panel.getByText("Bob Member")).toBeVisible();

  // Bob now sees and can open the channel, live — no reload needed on Ada's
  // side, but Bob does need to refetch his own channel list.
  await bobPage.reload();
  await bobPage.getByRole("link", { name: "secrets" }).click();
  await expect(bobPage.getByTestId("chat-channel-page")).toBeVisible();

  const bobComposer = bobPage.getByTestId("message-composer");
  await bobComposer.click();
  await bobPage.keyboard.type("Hi from Bob");
  await bobPage.getByTestId("message-send").click();
  await expect(bobPage.getByTestId("channel-messages").getByText("Hi from Bob")).toBeVisible();

  // Ada removes Bob; he loses access again.
  const removed = page.waitForResponse((res) => res.url().includes("members.remove"));
  await panel.getByLabel("Remove Bob Member").click();
  await removed;
  await expect(panel.getByText("Bob Member")).not.toBeVisible();

  await bobPage.reload();
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(bobPage.getByRole("link", { name: "secrets" })).not.toBeVisible();

  await bobContext.close();
});
