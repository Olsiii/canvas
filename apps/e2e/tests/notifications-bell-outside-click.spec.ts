import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

test("notifications bell: clicking outside the dropdown closes it", async ({ page }) => {
  await signUp(page, "Bell Tester");
  await createWorkspaceAndOpen(page, "Bell Workspace");

  await page.getByLabel("Notifications").click();
  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();

  await page.locator("main").click({ position: { x: 400, y: 300 } });
  await expect(page.getByText("Notifications", { exact: true })).not.toBeVisible();
});
