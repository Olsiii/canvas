import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("Generate panel: explicitly picking a brand kit overrides the auto-resolved default", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Brand Picker Tester");
  await createWorkspaceAndOpen(page, "Brand Picker Workspace");

  // Workspace default kit has no palette; a second kit does.
  await page.getByRole("link", { name: "Brand Kits", exact: true }).click();
  await page.getByTestId("brand-kit-new").click();
  await page.getByTestId("brand-kit-name").fill("Workspace Default");
  await page.getByTestId("brand-kit-save").click();
  await expect(page.getByText("Workspace Default")).toBeVisible();

  await page.getByTestId("brand-kit-new").click();
  await page.getByTestId("brand-kit-name").fill("Client Palette");
  const paletteInput = page.getByTestId("brand-kit-palette");
  await paletteInput.click();
  await paletteInput.pressSequentially("#112233, #445566");
  await page.getByTestId("brand-kit-save").click();
  await expect(page.getByText("Client Palette")).toBeVisible();

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await createSpaceAndList(page, "Ops", "Sprint");

  await page.getByRole("button", { name: "Generate" }).click();
  const panel = page.getByTestId("generation-panel");
  await expect(panel).toBeVisible();

  // With no explicit kit chosen, the default (empty palette) applies.
  await expect(panel.getByText("(none set yet)")).toBeVisible();

  await panel.getByTestId("generation-brand-kit").selectOption({ label: "Client Palette" });
  await expect(panel.getByText("(none set yet)")).not.toBeVisible();
});

test("Brain panel: a chosen brand persists across reopening the same conversation", async ({
  page,
}) => {
  await signUp(page, "Brain Brand Tester");
  await createWorkspaceAndOpen(page, "Brain Brand Workspace");

  await page.getByRole("link", { name: "Brand Kits", exact: true }).click();
  await page.getByTestId("brand-kit-new").click();
  await page.getByTestId("brand-kit-name").fill("Acme Corp");
  await page.getByTestId("brand-kit-save").click();
  await expect(page.getByText("Acme Corp")).toBeVisible();

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Brain" }).click();
  const panel = page.getByTestId("brain-chat-panel");
  await expect(panel).toBeVisible();

  const brandSelect = panel.getByTestId("brain-brand-kit");
  await expect(brandSelect).toBeVisible();
  const saved = page.waitForResponse((res) => res.url().includes("setBrandKit"));
  await brandSelect.selectOption({ label: "Acme Corp" });
  await saved;

  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Brain" }).click();
  await expect(page.getByTestId("brain-chat-panel").getByTestId("brain-brand-kit")).toHaveValue(
    /.+/,
  );
});
