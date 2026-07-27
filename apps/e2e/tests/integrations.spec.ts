import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

test("M5.6 integrations: Slack notify automation posts a message on status change", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Integrations Owner");
  await createWorkspaceAndOpen(page, "Integrations Workspace");
  await createSpaceAndList(page, "Marketing", "Launches");

  // A tiny local HTTP server stands in for a Slack Incoming Webhook.
  const received: string[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push(Buffer.concat(chunks).toString("utf8"));
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const slackPort = (server.address() as AddressInfo).port;
  const slackWebhookUrl = `http://127.0.0.1:${slackPort}/slack`;

  try {
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page
      .getByTestId("status-column-To Do")
      .getByRole("button", { name: "+ Add task" })
      .click();
    await page.getByPlaceholder("Task title").fill("Announce the launch");
    await page.keyboard.press("Enter");

    // Build the automation: status -> Done, notify Slack.
    await page.getByRole("link", { name: "Automations", exact: true }).click();
    await expect(page.getByTestId("automations-list-page")).toBeVisible();
    await page.getByTestId("automations-new").click();
    await page.getByTestId("automations-new-name").fill("Ship announcement to Slack");

    await page.getByTestId("automation-action-type-0").selectOption("slack_notify");
    await page.getByTestId("automation-action-webhook-url-0").fill(slackWebhookUrl);
    await page.getByTestId("automation-action-message-0").fill("{{title}} shipped");

    const automationCreated = page.waitForResponse((res) =>
      res.url().includes("automation.create"),
    );
    await page.getByTestId("automations-create-submit").click();
    await automationCreated;
    await expect(page.getByTestId(/^automations-link-/)).toBeVisible();

    // Trigger it: move "Announce the launch" to Done.
    await page.getByRole("link", { name: "Launches" }).click();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page.getByRole("button", { name: "Announce the launch" }).click();
    const panel = page.getByTestId("task-detail-panel");
    const updated = page.waitForResponse((res) => res.url().includes("task.update"));
    await panel.getByLabel("Status").selectOption({ label: "Done" });
    await updated;

    // Delivered asynchronously via the slack-jobs BullMQ queue — poll briefly.
    await expect.poll(() => received.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const body = JSON.parse(received[0]!) as { text: string };
    expect(body.text).toBe("Announce the launch shipped");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("M5.6 integrations: link a GitHub PR and attach a Google Drive file from a task", async ({
  page,
}) => {
  test.setTimeout(60_000);

  // Matches GITHUB_API_BASE_URL in playwright.config.ts's webServer env —
  // the API process reads that once at boot, so this mock server must bind
  // to this exact fixed port, same reasoning as imports.spec.ts's ClickUp mock.
  const GITHUB_MOCK_PORT = 4011;
  const githubMock = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/repos/acme/widgets/pulls/42") {
      res.end(JSON.stringify({ title: "Add dark mode toggle", state: "open", merged: false }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ message: "Not Found" }));
    }
  });
  await new Promise<void>((resolve) => githubMock.listen(GITHUB_MOCK_PORT, "127.0.0.1", resolve));

  try {
    await signUp(page, "Task Integrations Owner");
    await createWorkspaceAndOpen(page, "Task Integrations Workspace");
    await createSpaceAndList(page, "Engineering", "Backlog");

    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page
      .getByTestId("status-column-To Do")
      .getByRole("button", { name: "+ Add task" })
      .click();
    await page.getByPlaceholder("Task title").fill("Ship dark mode");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Ship dark mode" }).click();
    const panel = page.getByTestId("task-detail-panel");
    await expect(panel.getByLabel("Task title")).toHaveValue("Ship dark mode");

    // Link a GitHub PR — the pasted URL is a real github.com URL; only the
    // API call the server makes to fetch its title/status is redirected to
    // the local mock above via GITHUB_API_BASE_URL.
    await panel.getByTestId("pr-link-url-input").fill("https://github.com/acme/widgets/pull/42");
    const prLinked = page.waitForResponse((res) => res.url().includes("prLink.create"));
    await panel.getByTestId("pr-link-add").click();
    await prLinked;
    const prLink = panel.locator('[data-testid^="pr-link-row-"]').first();
    await expect(prLink).toContainText("Add dark mode toggle");
    await expect(prLink.getByText("Open")).toBeVisible();

    // Attach a file from Google Drive by its share link (the always-available
    // paste-link path — see PROGRESS.md).
    await panel.getByTestId("attach-drive-toggle").click();
    await panel
      .getByTestId("attach-drive-url")
      .fill("https://drive.google.com/file/d/1AbCdeFGhijkLmNoP/view?usp=sharing");
    await panel.getByTestId("attach-drive-name").fill("Dark mode mockup.png");
    const attached = page.waitForResponse((res) => res.url().includes("attachment.attachExternal"));
    await panel.getByTestId("attach-drive-submit").click();
    await attached;
    await expect(panel.getByText("Dark mode mockup.png")).toBeVisible();
    const driveLink = panel.getByRole("link", { name: /Dark mode mockup\.png/ });
    await expect(driveLink).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/1AbCdeFGhijkLmNoP/view",
    );

    // Both persist across a reload.
    await page.reload();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page.getByRole("button", { name: "Ship dark mode" }).click();
    await expect(panel.locator('[data-testid^="pr-link-state-"]').first()).toHaveText("Open");
    await expect(panel.getByText("Dark mode mockup.png")).toBeVisible();
  } finally {
    await new Promise<void>((resolve) => githubMock.close(() => resolve()));
  }
});
