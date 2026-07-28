import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

test("Importers: a CSV uploaded from your computer creates a space, list, and tasks", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "CSV Owner");
  await createWorkspaceAndOpen(page, "CSV Workspace");

  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(page.getByTestId("import-page")).toBeVisible();

  const csv = [
    "Card Name,Card List,Card Labels,Card Due Date",
    "Fix login bug,Doing,bug,2026-08-05",
    "Write release notes,Done,docs,2026-08-01",
  ].join("\n");

  await page.getByTestId("csv-space-name").fill("Board Import");
  await page.getByTestId("csv-list-name").fill("Sprint Board");
  await page
    .getByTestId("csv-file-input")
    .setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByTestId("csv-import-start").click();

  const row = page.locator('[data-testid^="import-row-"]').first();
  await expect(row).toBeVisible();
  await expect(row.locator('[data-testid^="import-status-"]')).toHaveText("done", {
    timeout: 20_000,
  });
  await expect(row).toContainText("Computer upload");
  await expect(row).toContainText("2 tasks");

  const spaceRow = page.locator("div.group", { hasText: "Board Import" }).first();
  await expect(spaceRow).toBeVisible();
  const listLink = page.getByRole("link", { name: "Sprint Board" });
  await expect(listLink).toBeVisible();
  await listLink.click();

  await expect(page.getByText("Fix login bug")).toBeVisible();
  await expect(page.getByText("Write release notes")).toBeVisible();
});

test("Importers: Google Sheets import rejects a non-Google URL before ever fetching it", async ({
  page,
}) => {
  test.setTimeout(60_000);

  // Verifies the host-allowlist guard specifically (an arbitrary URL must
  // be rejected, not fetched) — the actual parse-and-create pipeline once a
  // URL passes that check is the same `parseImportCsv` → `runCsvImport`
  // path the computer-upload test above already exercises end to end.
  await signUp(page, "Sheet Owner");
  await createWorkspaceAndOpen(page, "Sheet Workspace");

  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(page.getByTestId("import-page")).toBeVisible();

  await page.getByTestId("sheet-url").fill("http://127.0.0.1:9/not-google.csv");
  await page.getByTestId("sheet-space-name").fill("Sheet Import");
  await page.getByTestId("sheet-list-name").fill("Rows");
  await page.getByTestId("sheet-import-start").click();

  await expect(page.getByText(/Must be a Google Sheets link/)).toBeVisible();
});

test("Import page: Seri isn't wired up yet, and says so", async ({ page }) => {
  await signUp(page, "Seri Curious Owner");
  await createWorkspaceAndOpen(page, "Seri Workspace");

  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(page.getByTestId("seri-import-notice")).toContainText("Seri isn't built yet");
});
