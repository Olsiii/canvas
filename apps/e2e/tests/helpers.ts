import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function signUp(page: Page, name = "E2E Tester", email = uniqueEmail()) {
  await page.goto("/signup");
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText(email)).toBeVisible();
  return email;
}

export async function createWorkspaceAndOpen(page: Page, name: string) {
  await page.getByRole("link", { name: "New workspace" }).click();
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("link", { name: "Open" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

/** Invites an email to the workspace shown on the dashboard and returns the invite link. */
export async function inviteAndGetLink(page: Page, email: string) {
  await page.getByPlaceholder("teammate@example.com").fill(email);
  await page.getByRole("button", { name: "Invite" }).click();
  const link = page.locator("p", { hasText: "Invite link:" }).locator("span");
  await expect(link).toBeVisible();
  const href = await link.textContent();
  if (!href) throw new Error("Invite link was empty");
  return href;
}

/** Creates a space, then a list directly under it, and navigates into the list. */
export async function createSpaceAndList(page: Page, spaceName: string, listName: string) {
  await page.getByRole("button", { name: "New space" }).click();
  await page.getByPlaceholder("Space name").fill(spaceName);
  await page.keyboard.press("Enter");
  const spaceRow = page.locator("div.group", { hasText: spaceName }).first();
  await expect(spaceRow).toBeVisible();

  await spaceRow.hover();
  await spaceRow.getByRole("button", { name: "New list" }).click();
  await page.getByPlaceholder("List name").fill(listName);
  await page.keyboard.press("Enter");

  const listLink = page.getByRole("link", { name: `# ${listName}` });
  await expect(listLink).toBeVisible();
  await listLink.click();
  await expect(page.getByRole("heading", { name: `# ${listName}` })).toBeVisible();
}
