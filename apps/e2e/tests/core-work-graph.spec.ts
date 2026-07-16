import { expect, test } from "@playwright/test";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("sign up, build a workspace hierarchy, and manage tasks across board + list views", async ({
  page,
}) => {
  const email = uniqueEmail();

  // --- M0.2: sign up ---
  await page.goto("/signup");
  await page.locator("#name").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText(email)).toBeVisible();

  // --- M0.2: create + open a workspace ---
  await page.getByRole("link", { name: "New workspace" }).click();
  await page.getByLabel("Workspace name").fill("E2E Workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("link", { name: "Open" }).click();
  await expect(page.getByText("E2E Workspace")).toBeVisible();

  // --- M1.1: create a space, then a list directly under it ---
  await page.getByRole("button", { name: "New space" }).click();
  await page.getByPlaceholder("Space name").fill("Engineering");
  await page.keyboard.press("Enter");
  const spaceRow = page.locator("div.group", { hasText: "Engineering" }).first();
  await expect(spaceRow).toBeVisible();

  await spaceRow.hover();
  await spaceRow.getByRole("button", { name: "New list" }).click();
  await page.getByPlaceholder("List name").fill("Sprint Board");
  await page.keyboard.press("Enter");

  const listLink = page.getByRole("link", { name: "# Sprint Board" });
  await expect(listLink).toBeVisible();
  await listLink.click();
  await expect(page.getByRole("heading", { name: "# Sprint Board" })).toBeVisible();

  // --- M1.2: default statuses were seeded, add a task via the board view ---
  await page.getByRole("button", { name: "Board", exact: true }).click();
  const todoColumn = page.getByTestId("status-column-To Do");
  await expect(todoColumn).toBeVisible();
  await expect(page.getByTestId("status-column-In Progress")).toBeVisible();
  await expect(page.getByTestId("status-column-Done")).toBeVisible();

  await todoColumn.getByRole("button", { name: "+ Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Ship the launch email");
  await page.keyboard.press("Enter");
  await expect(todoColumn.getByText("Ship the launch email")).toBeVisible();

  // --- M1.3: the same task shows up in the list view ---
  await page.getByRole("button", { name: "List", exact: true }).click();
  const titleCell = page.getByRole("button", { name: "Ship the launch email" });
  await expect(titleCell).toBeVisible();

  // inline title edit
  await titleCell.click();
  const titleInput = page.locator("input:focus");
  await titleInput.fill("Ship the launch email v2");
  await titleInput.press("Enter");
  await expect(page.getByRole("button", { name: "Ship the launch email v2" })).toBeVisible();

  // group by status
  await page.getByRole("button", { name: /Group by status/ }).click();
  await expect(page.getByText("To Do (1)")).toBeVisible();

  // search filters the task out
  await page.getByPlaceholder("Search titles…").fill("no such task");
  await expect(page.getByText("0 tasks")).toBeVisible();
  await page.getByPlaceholder("Search titles…").fill("");
  await expect(page.getByText("1 task", { exact: true })).toBeVisible();
});
