import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

test("Docs toolbar: heading, bullet list, and numbered list all apply", async ({ page }) => {
  test.setTimeout(60_000);

  await signUp(page, "Docs Toolbar Tester");
  await createWorkspaceAndOpen(page, "Docs Toolbar Workspace");

  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await page.getByTestId("docs-new").click();
  await page.getByTestId("docs-new-title").fill("Client proposal");
  await page.getByTestId("docs-create").click();
  await expect(page.getByTestId("doc-editor-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("doc-sync-status")).toHaveText("Synced", { timeout: 15_000 });

  const toolbar = page.getByTestId("doc-toolbar");
  await expect(toolbar).toBeVisible();
  const editor = page.getByTestId("doc-editor");

  // --- Heading (a block-level toggle — just needs the cursor in the
  // paragraph, no text selection required) ---
  await editor.click();
  await page.keyboard.type("Proposal for Acme Co");
  await toolbar.getByTestId("doc-toolbar-heading").selectOption("1");
  await expect(editor.locator("h1")).toContainText("Proposal for Acme Co");

  // The toolbar's own chain().focus() call returns focus to the editor
  // after a button/select interaction — typing continues right where the
  // cursor already was, same as a real user clicking the toolbar then
  // typing without touching the document again.
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  // --- Bullet list ---
  await toolbar.getByRole("button", { name: "Bullet list" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.type("First deliverable");
  await expect(editor.locator("ul li")).toContainText("First deliverable");

  // Exit the list (two Enters on an empty item).
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  // --- Numbered list ---
  await toolbar.getByRole("button", { name: "Numbered list" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.type("Step one");
  await expect(editor.locator("ol li")).toContainText("Step one");
});
