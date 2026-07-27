import { expect, test } from "@playwright/test";
import {
  createSpaceAndList,
  createWorkspaceAndOpen,
  inviteAndGetLink,
  signUp,
  uniqueEmail,
} from "./helpers";

test("M4.1 docs: two users see each other's collaborative edits", async ({ page, browser }) => {
  test.setTimeout(90_000);

  await signUp(page, "Ada Docs");
  await createWorkspaceAndOpen(page, "Docs Workspace");
  await createSpaceAndList(page, "Creative", "Campaigns");

  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page.getByTestId("docs-list-page")).toBeVisible();
  await page.getByTestId("docs-new").click();
  await page.getByTestId("docs-new-title").fill("Shared brief");
  await page.getByTestId("docs-create").click();
  await expect(page.getByTestId("doc-editor-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("doc-sync-status")).toHaveText("Synced", { timeout: 15_000 });

  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = uniqueEmail("bob-docs");
  const inviteLink = await inviteAndGetLink(page, bobEmail);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signUp(bobPage, "Bob Docs", bobEmail);
  await bobPage.goto(inviteLink);
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  await expect(bobPage.getByText("Docs Workspace", { exact: true })).toBeVisible();

  await bobPage.getByRole("link", { name: "Open" }).click();
  await bobPage.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(bobPage.getByText("Shared brief")).toBeVisible({ timeout: 15_000 });
  await bobPage.getByRole("link", { name: "Shared brief" }).click();
  await expect(bobPage.getByTestId("doc-editor-page")).toBeVisible();
  await expect(bobPage.getByTestId("doc-sync-status")).toHaveText("Synced", { timeout: 15_000 });

  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await page.getByRole("link", { name: "Shared brief" }).click();
  await expect(page.getByTestId("doc-sync-status")).toHaveText("Synced", { timeout: 15_000 });

  const aliceEditor = page.getByTestId("doc-editor");
  await aliceEditor.click();
  await page.keyboard.type("Hello from Ada");

  await expect(bobPage.getByTestId("doc-editor")).toContainText("Hello from Ada", {
    timeout: 15_000,
  });

  const bobEditor = bobPage.getByTestId("doc-editor");
  await bobEditor.click();
  await bobPage.keyboard.press("End");
  await bobPage.keyboard.type(" and Bob");

  await expect(page.getByTestId("doc-editor")).toContainText("Hello from Ada and Bob", {
    timeout: 15_000,
  });

  await bobContext.close();
});
