import http from "node:http";
import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

// Matches CLICKUP_API_BASE_URL in playwright.config.ts's webServer env —
// the API process reads that once at boot, so this mock server must bind
// to this exact fixed port (not a random one the way api-platform.spec.ts's
// webhook receiver does) for the running API process to ever reach it.
const CLICKUP_MOCK_PORT = 4010;

function startClickUpMock() {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = req.url ?? "";

    if (url === "/team") {
      res.end(JSON.stringify({ teams: [{ id: "team1", name: "Mock Team" }] }));
    } else if (url.startsWith("/team/team1/space")) {
      res.end(JSON.stringify({ spaces: [{ id: "space1", name: "Marketing" }] }));
    } else if (url.startsWith("/space/space1/folder")) {
      res.end(JSON.stringify({ folders: [{ id: "folder1", name: "Campaigns" }] }));
    } else if (url.startsWith("/space/space1/list")) {
      res.end(JSON.stringify({ lists: [] }));
    } else if (url.startsWith("/folder/folder1/list")) {
      res.end(JSON.stringify({ lists: [{ id: "list1", name: "Launch" }] }));
    } else if (url.startsWith("/list/list1/task")) {
      res.end(
        JSON.stringify({
          tasks: [
            {
              id: "task1",
              name: "Ship the launch email",
              text_content: "Draft and send to the list",
              status: { status: "In Progress", type: "custom" },
              priority: { id: "2" },
              due_date: "1700000000000",
              assignees: [],
              tags: [{ name: "launch" }],
            },
          ],
        }),
      );
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    }
  });
  return new Promise<http.Server>((resolve) => {
    server.listen(CLICKUP_MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

test("M5.5 importers: ClickUp API import brings in spaces/folders/lists/tasks", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const mockServer = await startClickUpMock();

  try {
    await signUp(page, "Import Owner");
    await createWorkspaceAndOpen(page, "Import Workspace");

    await page.getByRole("link", { name: "Import", exact: true }).click();
    await expect(page.getByTestId("import-page")).toBeVisible();

    await page.getByTestId("clickup-token-input").fill("fake-token-for-mock-server");
    await page.getByTestId("clickup-import-start").click();

    const row = page.locator('[data-testid^="import-row-"]').first();
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid^="import-status-"]')).toHaveText("done", {
      timeout: 20_000,
    });
    await expect(row).toContainText("1 space");
    await expect(row).toContainText("1 list");
    await expect(row).toContainText("1 task");

    const spaceRow = page.locator("div.group", { hasText: "Marketing" }).first();
    await expect(spaceRow).toBeVisible();
    const listLink = page.getByRole("link", { name: "# Launch" });
    await expect(listLink).toBeVisible();
    await listLink.click();

    await expect(page.getByText("Ship the launch email")).toBeVisible();
    await expect(page.getByRole("button", { name: "In Progress" })).toBeVisible();
  } finally {
    await new Promise((resolve) => mockServer.close(resolve));
  }
});

test("M5.5 importers: a Trello-style CSV import creates a space, list, and tasks", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "CSV Owner");
  await createWorkspaceAndOpen(page, "CSV Workspace");

  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(page.getByTestId("import-page")).toBeVisible();

  const csv = [
    "Card Name,Card List,Card Labels,Card Due Date",
    "Fix login bug,Doing,bug,2026-08-05",
    "Write release notes,Done,docs,2026-08-01",
  ].join("\n");

  await page.getByTestId("csv-tool-trello").check();
  await page.getByTestId("csv-space-name").fill("Board Import");
  await page.getByTestId("csv-list-name").fill("Sprint Board");
  await page
    .getByTestId("csv-file-input")
    .setInputFiles({ name: "trello-export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByTestId("csv-import-start").click();

  const row = page.locator('[data-testid^="import-row-"]').first();
  await expect(row).toBeVisible();
  await expect(row.locator('[data-testid^="import-status-"]')).toHaveText("done", {
    timeout: 20_000,
  });
  await expect(row).toContainText("2 tasks");

  const spaceRow = page.locator("div.group", { hasText: "Board Import" }).first();
  await expect(spaceRow).toBeVisible();
  const listLink = page.getByRole("link", { name: "# Sprint Board" });
  await expect(listLink).toBeVisible();
  await listLink.click();

  await expect(page.getByText("Fix login bug")).toBeVisible();
  await expect(page.getByText("Write release notes")).toBeVisible();
});
