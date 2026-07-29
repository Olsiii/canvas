import { expect, test } from "@playwright/test";

test("Privacy Policy and Terms of Service are reachable and cross-linked from signup/login", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByRole("link", { name: "Terms of Service" }).click();
  await expect(page.getByTestId("terms-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();

  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.getByTestId("privacy-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

  await page.goto("/login");
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.getByTestId("privacy-page")).toBeVisible();
});
