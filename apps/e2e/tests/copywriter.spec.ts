import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

const IMAGE_FIXTURE = fileURLToPath(new URL("../fixtures/test-image.png", import.meta.url));

test("Copywriter: generate on-brand copy for a brand kit, approve a variant, see it in history", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Copywriter Tester");
  await createWorkspaceAndOpen(page, "Copywriter Workspace");

  // Create a brand kit (the Copywriter's "client" profile) with the new
  // fonts/default-language fields.
  await page.getByRole("link", { name: "Brand Kits", exact: true }).click();
  await page.getByTestId("brand-kit-new").click();
  await page.getByTestId("brand-kit-name").fill("Acme Corp");
  await page.getByTestId("brand-kit-fonts").fill("Poppins Bold");
  await page.getByTestId("brand-kit-copy-language").selectOption("en");
  await page.getByTestId("brand-kit-save").click();
  await expect(page.getByText("Acme Corp")).toBeVisible();

  await page.getByRole("link", { name: "Copywriter" }).click();
  await expect(page.getByTestId("copywriter-list-page")).toBeVisible();
  await page.getByText("Acme Corp").click();

  const workspace = page.getByTestId("copywriter-workspace-page");
  await expect(workspace).toBeVisible();

  await workspace.getByTestId("copywriter-file-input").setInputFiles(IMAGE_FIXTURE);
  await workspace.getByTestId("copywriter-generate").click();

  const firstVariant = workspace.getByTestId("copywriter-variant-0");
  await expect(firstVariant).toBeVisible({ timeout: 30_000 });
  await expect(workspace.getByTestId("copywriter-variant-1")).toBeVisible();
  await expect(workspace.getByTestId("copywriter-variant-2")).toBeVisible();

  await firstVariant.getByRole("button", { name: "Approve" }).click();
  await expect(firstVariant.getByRole("button", { name: "Approved" })).toBeVisible();

  // History shows the same generation, and the approval carried over.
  await page.getByRole("link", { name: "All brand kits" }).click();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByTestId("copywriter-history-page")).toBeVisible();

  const historyRow = page.locator("[data-testid^='copywriter-generation-']").first();
  await expect(historyRow).toBeVisible();
  // The row's only real <button> is its header toggle — "Delete generation"
  // is a non-button element with an aria-label, not a form control, so
  // getByLabel wouldn't match it; targeting the toggle directly here avoids
  // any ambiguity about which point of the row Playwright's click lands on.
  await historyRow.locator("button").first().click();
  await expect(historyRow.getByRole("button", { name: "Approved" })).toBeVisible();

  // Deleting removes it from the list entirely.
  await historyRow.getByRole("button", { name: "Delete generation", exact: true }).click();
  await expect(page.locator("[data-testid^='copywriter-generation-']")).toHaveCount(0);
});

test("Copywriter: saving a variant files it under Library > Copy > brand kit", async ({ page }) => {
  test.setTimeout(60_000);

  await signUp(page, "Copywriter Library Tester");
  await createWorkspaceAndOpen(page, "Copywriter Library Workspace");

  await page.getByRole("link", { name: "Brand Kits", exact: true }).click();
  await page.getByTestId("brand-kit-new").click();
  await page.getByTestId("brand-kit-name").fill("Zone Club");
  await page.getByTestId("brand-kit-save").click();
  await expect(page.getByText("Zone Club")).toBeVisible();

  await page.getByRole("link", { name: "Copywriter" }).click();
  await page.getByText("Zone Club").click();

  const workspace = page.getByTestId("copywriter-workspace-page");
  await workspace.getByTestId("copywriter-file-input").setInputFiles(IMAGE_FIXTURE);
  await workspace.getByTestId("copywriter-generate").click();

  const firstVariant = workspace.getByTestId("copywriter-variant-0");
  await expect(firstVariant).toBeVisible({ timeout: 30_000 });
  await firstVariant.getByTestId("copywriter-save-to-library-0").click();
  await expect(firstVariant.getByTestId("copywriter-save-to-library-0")).toContainText("Saved");

  // Library: the "Copy" root folder appeared, and drilling in shows the
  // brand-kit child folder with the item just saved.
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();

  await expect(page.getByTestId("library-empty")).toContainText("Pick a brand kit");
  await page.getByRole("button", { name: "Zone Club", exact: true }).click();

  const savedItem = page.locator("[data-testid^='library-copy-item-']").first();
  await expect(savedItem).toBeVisible();
  await savedItem.click();

  const detailPanel = page.getByTestId("library-copy-detail-panel");
  await expect(detailPanel).toBeVisible();

  // Deleting it from the detail panel empties the brand-kit folder.
  await page.getByTestId("library-copy-item-delete").click();
  await expect(page.getByTestId("library-empty")).toContainText("No copy saved");

  // Backing out returns to the top level, where "Copy" is still listed
  // (the folder itself isn't deleted, just now empty).
  await page.getByTestId("library-folder-back").click();
  await expect(page.getByTestId("library-empty")).toContainText("Pick a brand kit");
});
