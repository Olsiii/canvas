import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, inviteAndGetLink, signUp } from "./helpers";

test("invite a member with a role, change their role, then remove them", async ({
  page,
  browser,
}) => {
  await signUp(page, "Nia Owner");
  await createWorkspaceAndOpen(page, "Ops Workspace");

  await page.getByRole("link", { name: "All workspaces" }).click();
  const bobEmail = `bob-${Date.now()}@example.com`;
  const inviteLink = await inviteAndGetLink(page, bobEmail, "admin");

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signUp(bobPage, "Bob Admin", bobEmail);
  await bobPage.goto(inviteLink);
  const accepted = bobPage.waitForResponse((res) => res.url().includes("acceptInvite"));
  await bobPage.getByRole("button", { name: /Accept & join/ }).click();
  const acceptedResponse = await accepted;
  expect(acceptedResponse.ok()).toBe(true);
  // the dashboard's workspace row (not the invite page's own heading, which
  // also contains this exact text) confirms the join actually landed
  await expect(bobPage.getByRole("link", { name: "Open" })).toBeVisible();
  await bobContext.close();

  // back on Nia's side: open the workspace and confirm the members panel.
  // Scoped to the member list rows, since the sidebar's own user footer also
  // shows the signed-in user's name ("Nia Owner").
  await page.getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("listitem").getByText("Nia Owner")).toBeVisible();
  await expect(page.getByRole("listitem").getByText("Bob Admin")).toBeVisible();
  await expect(page.getByLabel("Role for Bob Admin")).toHaveValue("admin");

  // demote Bob to guest
  const roleChanged = page.waitForResponse((res) => res.url().includes("updateMemberRole"));
  await page.getByLabel("Role for Bob Admin").selectOption("guest");
  await roleChanged;
  await expect(page.getByLabel("Role for Bob Admin")).toHaveValue("guest");

  // the owner's own row has no management controls
  await expect(page.getByLabel("Role for Nia Owner")).toHaveCount(0);

  // reload to confirm the role change persisted server-side
  await page.reload();
  await expect(page.getByLabel("Role for Bob Admin")).toHaveValue("guest");

  // remove Bob
  const removed = page.waitForResponse((res) => res.url().includes("removeMember"));
  await page.getByRole("button", { name: "Remove Bob Admin" }).click();
  await removed;
  await expect(page.getByText("Bob Admin")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Bob Admin")).toHaveCount(0);
});
