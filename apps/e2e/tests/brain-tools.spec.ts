import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("Brain tools: generate image via chat, show status, then attach to task", async ({ page }) => {
  test.setTimeout(90_000);

  await signUp(page, "Brain Tools Tester");
  await createWorkspaceAndOpen(page, "Brain Tools Workspace");
  await createSpaceAndList(page, "Creative", "Campaigns");

  await page.getByRole("button", { name: "Board", exact: true }).click();
  const todoColumn = page.getByTestId("status-column-To Do");
  await todoColumn.getByRole("button", { name: "+ Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Hero banner");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Hero banner" }).click();
  await expect(page.getByLabel("Task title")).toHaveValue("Hero banner");

  await page.getByRole("button", { name: "Ask Brain about this task" }).click();
  const brainPanel = page.getByTestId("brain-chat-panel");
  await expect(brainPanel).toBeVisible();

  await brainPanel
    .getByTestId("brain-message-input")
    .fill("Generate an image of a red square banner");
  await brainPanel.getByRole("button", { name: "Send" }).click();

  // Status line and/or final assistant text acknowledging generate_image
  await expect(
    brainPanel.getByText(/generate_image|Image ready|Generating image/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  await expect(brainPanel.getByText(/generate_image completed successfully/i)).toBeVisible({
    timeout: 30_000,
  });

  // Extract asset id from the assistant's JSON-ish reply for the attach step
  const body = await brainPanel.innerText();
  const assetMatch = body.match(
    /"assetId"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i,
  );
  expect(assetMatch?.[1]).toBeTruthy();
  const assetId = assetMatch![1]!;

  await brainPanel.getByTestId("brain-message-input").fill(`Attach ${assetId} to this task`);
  await brainPanel.getByRole("button", { name: "Send" }).click();

  await expect(brainPanel.getByText(/attach_to_task completed successfully/i)).toBeVisible({
    timeout: 30_000,
  });

  await brainPanel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText(/Attachments \(1\)/)).toBeVisible({ timeout: 10_000 });
});
