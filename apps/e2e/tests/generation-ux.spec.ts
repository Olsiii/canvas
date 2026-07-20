import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("Generation UX: set brand palette, generate variants, promote one, attach to task", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await signUp(page, "Gen UX Tester");
  await createWorkspaceAndOpen(page, "Gen UX Workspace");

  // Brand settings on workspace home
  const paletteInput = page.getByTestId("brand-palette-input");
  await paletteInput.click();
  await paletteInput.fill("");
  await paletteInput.pressSequentially("#FF0000, #00FF00");
  await expect(paletteInput).toHaveValue("#FF0000, #00FF00");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Brand settings saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("brand-palette-input")).toHaveValue(/#FF0000/, { timeout: 10_000 });

  await createSpaceAndList(page, "Creative", "Campaigns");
  await page.getByRole("button", { name: "Board", exact: true }).click();
  const todoColumn = page.getByTestId("status-column-To Do");
  await todoColumn.getByRole("button", { name: "+ Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Launch art");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Launch art" }).click();
  await expect(page.getByLabel("Task title")).toHaveValue("Launch art");

  const panel = page.getByTestId("task-detail-panel");
  const gen = panel.getByTestId("generation-panel");
  await expect(gen).toBeVisible();

  await gen.getByTestId("generation-prompt").fill("a bold red product shot");
  await gen.getByTestId("generation-n").selectOption("2");
  await gen.getByTestId("generation-use-brand").check();
  await gen.getByTestId("generation-submit").click();

  await expect(gen.getByTestId("generation-variants")).toBeVisible({ timeout: 30_000 });
  const variants = gen.getByTestId("generation-variants").locator("button");
  await expect(variants).toHaveCount(2, { timeout: 30_000 });

  // Promote the second variant
  await variants.nth(1).click();
  await expect(variants.nth(1)).toHaveAttribute("aria-pressed", "true");

  await gen.getByTestId("generation-attach").click();
  await expect(gen.getByText("Attached to task")).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText(/Attachments \(1\)/)).toBeVisible({ timeout: 10_000 });
});
