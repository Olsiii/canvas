import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, inviteAndGetLink, signUp } from "./helpers";

test("M4.3 chat: create a channel, thread a reply, see a teammate's message live, and ask Brain", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);

  await signUp(page, "Ada Chat");
  await createWorkspaceAndOpen(page, "Chat Workspace");

  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(page.getByTestId("chat-channel-list-page")).toBeVisible();
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByTestId("chat-new-channel-name").fill("general");
  await page.getByTestId("chat-create-channel").click();
  await expect(page.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "general" })).toBeVisible();

  const composer = page.getByTestId("message-composer");
  await composer.click();
  await page.keyboard.type("Hello team");
  await page.getByTestId("message-send").click();
  await expect(page.getByTestId("channel-messages").getByText("Hello team")).toBeVisible();

  // Thread a reply on Ada's own message — replying opens a dedicated thread
  // panel (its own composer/send, distinct from the channel's main ones).
  await page.getByTestId("channel-messages").getByText("Hello team").hover();
  await page.getByRole("button", { name: "Reply" }).click();
  const threadPanel = page.getByTestId("thread-panel");
  await expect(threadPanel).toBeVisible();
  const replyComposer = threadPanel.getByTestId("message-composer");
  await replyComposer.click();
  await page.keyboard.type("On it!");
  await threadPanel.getByTestId("message-send").click();
  await expect(threadPanel.getByText("On it!")).toBeVisible();
  await threadPanel.getByRole("button", { name: "Close", exact: true }).click();
  // The thread's last reply also shows as a preview under the parent message
  // in the main channel list.
  await expect(page.getByTestId("channel-messages").getByText("On it!")).toBeVisible();

  // Invite Bob as a second, real user in a separate browser context
  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = `bob-chat-${Date.now()}@example.com`;
  const inviteLink = await inviteAndGetLink(page, bobEmail);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signUp(bobPage, "Bob Chat", bobEmail);
  await bobPage.goto(inviteLink);
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  await expect(bobPage.getByText("Chat Workspace", { exact: true })).toBeVisible();

  await bobPage.getByRole("link", { name: "Open" }).click();
  await bobPage.getByRole("link", { name: "Chat", exact: true }).click();
  await bobPage.getByRole("link", { name: "general" }).click();
  await expect(bobPage.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });
  await expect(bobPage.getByTestId("channel-messages").getByText("Hello team")).toBeVisible();

  // Ada leaves her page open — no reload — while Bob posts. Any update Ada
  // sees below can only have arrived over the WS invalidation channel.
  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("link", { name: "general" }).click();
  await expect(page.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });

  const bobComposer = bobPage.getByTestId("message-composer").first();
  await bobComposer.click();
  await bobPage.keyboard.type("Hi Ada, got it");
  await bobPage.getByTestId("message-send").first().click();

  await expect(page.getByTestId("channel-messages").getByText("Hi Ada, got it")).toBeVisible({
    timeout: 15_000,
  });

  // Brain in chat
  await page.getByTestId("channel-ask-brain").click();
  const brainPanel = page.getByTestId("brain-chat-panel");
  await expect(brainPanel).toBeVisible();
  await expect(brainPanel.getByText("Brain — this channel")).toBeVisible();

  const prompt = "Summarize this channel";
  await brainPanel.getByTestId("brain-message-input").fill(prompt);
  await brainPanel.getByRole("button", { name: "Send" }).click();
  await expect(brainPanel.getByText(`You said: "${prompt}"`, { exact: false })).toBeVisible({
    timeout: 20_000,
  });

  await bobContext.close();
});
