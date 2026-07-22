import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("M4.5 forms: build an intake form, submit it anonymously, and see the task land in the list", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Form Builder");
  await createWorkspaceAndOpen(page, "Intake Workspace");
  await createSpaceAndList(page, "Support", "Bug Reports");

  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page.getByTestId("forms-list-page")).toBeVisible();

  await page.getByTestId("forms-new").click();
  await page.getByTestId("forms-new-name").fill("Bug report intake");
  await page.getByTestId("forms-new-list").selectOption({ label: "Support / Bug Reports" });
  await page.getByTestId("form-field-title-label").fill("What's broken?");

  await page.getByTestId("form-add-field").click();
  await page.getByTestId("form-field-label").fill("Severity");
  await page.locator("select").last().selectOption("select");
  await page.getByTestId("form-field-options").fill("Low, High");

  const formCreated = page.waitForResponse((res) => res.url().includes("form.create"));
  await page.getByTestId("forms-create-submit").click();
  await formCreated;

  const formLink = page.getByTestId(/^forms-link-/);
  await expect(formLink).toBeVisible();
  await formLink.click();
  await expect(page.getByTestId("form-editor-page")).toBeVisible();

  const publicUrl = await page.getByTestId("form-public-link").inputValue();
  expect(publicUrl).toContain("/forms/");

  // Submit the form as an anonymous visitor in a fresh browser context —
  // no sign-up, no session.
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(publicUrl);
  await expect(publicPage.getByTestId("public-form-page")).toBeVisible();

  await publicPage.getByTestId("public-form-field-title").fill("Login button does nothing");
  await publicPage.getByTestId(/^public-form-field-field-/).selectOption("High");
  const submitted = publicPage.waitForResponse((res) => res.url().includes("submitPublic"));
  await publicPage.getByTestId("public-form-submit").click();
  await submitted;
  await expect(publicPage.getByText("Thanks — your submission was received.")).toBeVisible();
  await publicContext.close();

  // Back as the workspace member: the anonymous submission became a real
  // task in the target list.
  await page.getByRole("link", { name: "← All workspaces" }).click();
  await page.getByRole("link", { name: "Open" }).click();
  await page.getByRole("link", { name: "# Bug Reports" }).click();
  await expect(page.getByRole("heading", { name: "# Bug Reports" })).toBeVisible();

  // Board view's card is a single button that opens the detail panel; list
  // view's title cell is an inline-rename button instead (see
  // task-list-view.tsx), so switch views to open the task the same way
  // task-templates.spec.ts does.
  await page.getByRole("button", { name: "Board", exact: true }).click();
  const taskCard = page.getByRole("button", { name: "Login button does nothing" });
  await expect(taskCard).toBeVisible({ timeout: 15_000 });
  await taskCard.click();

  const panel = page.getByTestId("task-detail-panel");
  await expect(panel.getByText("Severity: High")).toBeVisible();
});
