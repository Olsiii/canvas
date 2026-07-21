import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

function dateOnlyOffsetFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("M3.8: workload shows tasks due this week per assignee, excludes tasks outside the range", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const name = "Workload Tester";
  await signUp(page, name);
  await createWorkspaceAndOpen(page, "Workload Workspace");
  await createSpaceAndList(page, "Ops", "Sprint");

  await page.getByRole("button", { name: "Board", exact: true }).click();
  const todoColumn = page.getByTestId("status-column-To Do");

  for (const title of ["Design mockups", "Write copy"]) {
    await todoColumn.getByRole("button", { name: "+ Add task" }).click();
    await page.getByPlaceholder("Task title").fill(title);
    await page.keyboard.press("Enter");
    await expect(todoColumn.getByRole("button", { name: title })).toBeVisible();
  }

  const today = dateOnlyOffsetFromToday(0);
  const farFuture = dateOnlyOffsetFromToday(60);

  // "Design mockups": due today, assigned to self — should show up on the
  // current week's grid.
  await page.getByRole("button", { name: "Design mockups" }).click();
  let panel = page.getByTestId("task-detail-panel");
  await panel.getByTestId("task-due-date").fill(today);
  const assignedFirst = page.waitForResponse((res) => res.url().includes("assignees.add"));
  await panel.getByLabel("Assign someone").selectOption({ label: name });
  await assignedFirst;
  await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // "Write copy": due 60 days out, also assigned to self — outside this
  // week's range, so it must not appear on the default (current-week) grid.
  await page.getByRole("button", { name: "Write copy" }).click();
  panel = page.getByTestId("task-detail-panel");
  await panel.getByTestId("task-due-date").fill(farFuture);
  const assignedSecond = page.waitForResponse((res) => res.url().includes("assignees.add"));
  await panel.getByLabel("Assign someone").selectOption({ label: name });
  await assignedSecond;
  await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("link", { name: "Workload", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workload", exact: true })).toBeVisible();

  const userRow = page.locator('[data-testid^="workload-row-"]').filter({ hasText: name });
  await expect(userRow).toBeVisible();

  // Today's cell for this user shows "Design mockups"...
  const cellId = await userRow.getAttribute("data-testid");
  const userId = cellId!.replace("workload-row-", "");
  const todayCell = page.getByTestId(`workload-cell-${userId}-${today}`);
  await expect(todayCell.getByRole("button", { name: "Design mockups" })).toBeVisible();

  // ...but "Write copy" (60 days out) is nowhere on this week's grid, and
  // the weekly total only counts the one in-range task.
  await expect(page.getByText("Write copy")).toHaveCount(0);
  await expect(page.getByTestId(`workload-total-${userId}`)).toHaveText("1");

  // Clicking the chip opens the real task detail panel.
  await todayCell.getByRole("button", { name: "Design mockups" }).click();
  await expect(page.getByTestId("task-detail-panel").getByLabel("Task title")).toHaveValue(
    "Design mockups",
  );
});
