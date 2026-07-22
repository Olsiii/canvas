import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("M5.3 goals: task-completion progress from linked tasks, and a manually-tracked numeric goal", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Goal Owner");
  await createWorkspaceAndOpen(page, "Goal Workspace");
  await createSpaceAndList(page, "Ops", "Sprint");

  await page.getByRole("button", { name: "Board", exact: true }).click();
  const todoColumn = page.getByTestId("status-column-To Do");

  await todoColumn.getByRole("button", { name: "+ Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Fix login crash");
  await page.keyboard.press("Enter");

  await todoColumn.getByRole("button", { name: "+ Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Fix upload crash");
  await page.keyboard.press("Enter");

  // Move "Fix login crash" to Done, leave "Fix upload crash" open.
  await page.getByRole("button", { name: "Fix login crash" }).click();
  const panel = page.getByTestId("task-detail-panel");
  const doneUpdate = page.waitForResponse((res) => res.url().includes("task.update"));
  await panel.getByLabel("Status").selectOption({ label: "Done" });
  await doneUpdate;
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // Task-completion goal: link both tasks, expect 50% (one of two done).
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await expect(page.getByTestId("goals-list-page")).toBeVisible();
  await page.getByTestId("goals-new").click();
  await page.getByTestId("goals-new-name").fill("Sprint goals");
  const goalCreated = page.waitForResponse((res) => res.url().includes("goal.create"));
  await page.getByTestId("goals-create-submit").click();
  await goalCreated;
  await expect(page.getByTestId(/^goals-link-/)).toBeVisible();
  await page.getByTestId(/^goals-link-/).click();
  await expect(page.getByTestId("goal-editor-page")).toBeVisible();

  // Locators scoped to "goal-linked-task-" (the linked-pill testid), not
  // "goal-task-link-" — the latter prefix is shared by the search box
  // (goal-task-link-search) and its result buttons (goal-task-link-result-),
  // so a prefix match against it would silently count those as "linked"
  // too and never actually wait for the add to land.
  await page.getByTestId("goal-task-link-search").fill("Fix login crash");
  await expect(page.locator("[data-testid^='goal-task-link-result-']")).toHaveCount(1);
  await page.locator("[data-testid^='goal-task-link-result-']").click();
  await expect(page.locator("[data-testid^='goal-linked-task-']")).toHaveCount(1);

  await page.getByTestId("goal-task-link-search").fill("Fix upload crash");
  await expect(page.locator("[data-testid^='goal-task-link-result-']")).toHaveCount(1);
  await page.locator("[data-testid^='goal-task-link-result-']").click();
  await expect(page.locator("[data-testid^='goal-linked-task-']")).toHaveCount(2);

  await expect(page.getByTestId("goal-progress")).toContainText("50%");

  // Numeric goal, created and then updated to a specific progress value.
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await page.getByTestId("goals-new").click();
  await page.getByTestId("goals-new-name").fill("Signups");
  await page.getByTestId("goals-metric-type").selectOption("numeric");
  await page.getByTestId("goals-metric-target").fill("200");
  const numericGoalCreated = page.waitForResponse((res) => res.url().includes("goal.create"));
  await page.getByTestId("goals-create-submit").click();
  await numericGoalCreated;

  // Select by name, not position — the list sorts alphabetically ("Signups"
  // sorts before "Sprint goals"), not by creation order.
  await page.locator('[data-testid^="goals-link-"]', { hasText: "Signups" }).click();
  await expect(page.getByTestId("goal-editor-page")).toBeVisible();
  await expect(page.getByTestId("goal-editor-current")).toBeVisible();
  await page.getByTestId("goal-editor-current").fill("80");
  const savedNumeric = page.waitForResponse((res) => res.url().includes("goal.update"));
  await page.getByTestId("goal-editor-save").click();
  await savedNumeric;
  await expect(page.getByTestId("goal-progress")).toContainText("40%");

  // Reload: both goals' progress persisted server-side.
  await page.reload();
  await expect(page.getByTestId("goal-progress")).toContainText("40%");
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await expect(page.getByTestId(/^goals-link-/)).toHaveCount(2);
});
