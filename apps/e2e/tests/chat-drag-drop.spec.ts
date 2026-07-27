import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceAndOpen, signUp } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("chat: dragging a file onto the composer attaches it, same as picking it", async ({
  page,
}) => {
  await signUp(page, "Drag Drop Tester");
  await createWorkspaceAndOpen(page, "Drag Drop Workspace");

  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByTestId("chat-new-channel-name").fill("dropzone");
  await page.getByTestId("chat-create-channel").click();
  await expect(page.getByTestId("chat-channel-page")).toBeVisible({ timeout: 15_000 });

  const bytes = [...fs.readFileSync(path.join(__dirname, "fixtures", "sample.txt"))];
  const dropzone = page.getByTestId("message-composer-dropzone");

  const dataTransfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer();
    const file = new File([new Uint8Array(data)], "sample.txt", { type: "text/plain" });
    dt.items.add(file);
    return dt;
  }, bytes);

  await dropzone.dispatchEvent("dragenter", { dataTransfer });
  await expect(page.getByText("Drop to attach")).toBeVisible();
  await dropzone.dispatchEvent("drop", { dataTransfer });

  await expect(page.getByText("Drop to attach")).not.toBeVisible();
  await expect(page.getByText("sample.txt")).toBeVisible();

  await page.getByTestId("message-composer").click();
  await page.keyboard.type("dropped a file");
  await page.getByTestId("message-send").click();

  await expect(page.getByTestId("channel-messages").getByText("dropped a file")).toBeVisible();
  await expect(page.getByRole("link", { name: /^sample\.txt/ })).toBeVisible();
});
