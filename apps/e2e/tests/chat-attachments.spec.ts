import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceAndOpen, signUp } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("chat: attach a file to a message and download it back", async ({ page }) => {
  await signUp(page, "File Sharer");
  await createWorkspaceAndOpen(page, "Files Workspace");

  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByTestId("chat-new-channel-name").fill("files");
  await page.getByTestId("chat-create-channel").click();
  await expect(page.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });

  const composer = page.getByTestId("message-composer");
  await composer.click();
  await page.keyboard.type("Here's the doc");

  const fileInput = page.getByLabel("Attach a file");
  await fileInput.setInputFiles(path.join(__dirname, "fixtures", "sample.txt"));
  await expect(page.getByText("sample.txt")).toBeVisible();

  await page.getByTestId("message-send").click();

  const message = page.getByTestId("channel-messages").getByText("Here's the doc");
  await expect(message).toBeVisible();

  const attachmentLink = page.getByRole("link", { name: /^sample\.txt/ });
  await expect(attachmentLink).toBeVisible();
  const href = await attachmentLink.getAttribute("href");
  expect(href).toMatch(/^\/uploads\//);

  const download = await page.request.get(`http://localhost:3001${href}`);
  expect(download.ok()).toBe(true);
  expect(await download.text()).toContain("Canvas chat attachment fixture");

  // A separate, explicit Download button forces a real browser download
  // (Content-Disposition: attachment) rather than the inline-preview link above.
  const downloadButton = page.getByRole("link", { name: "Download sample.txt" });
  await expect(downloadButton).toBeVisible();
  const [downloadEvent] = await Promise.all([
    page.waitForEvent("download"),
    downloadButton.click(),
  ]);
  expect(downloadEvent.suggestedFilename()).toBe("sample.txt");
});
