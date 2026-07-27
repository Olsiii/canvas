import { createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createSpaceAndList, createWorkspaceAndOpen, signUp } from "./helpers";

const API_ORIGIN = "http://localhost:3001";

test("M5.4 public REST API + webhooks: an API key creates a task, and a webhook fires signed on a status change", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  await signUp(page, "Platform Owner");
  await createWorkspaceAndOpen(page, "Platform Workspace");
  await createSpaceAndList(page, "Ops", "Sprint");

  const listId = page.url().match(/\/l\/([^/?#]+)/)?.[1];
  if (!listId) throw new Error("Could not read listId from the list URL");

  // A tiny local HTTP server stands in for a third-party webhook receiver.
  const received: { body: string; signature: string | null; event: string | null }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        body: Buffer.concat(chunks).toString("utf8"),
        signature: req.headers["x-canvas-signature"] as string | null,
        event: req.headers["x-canvas-event"] as string | null,
      });
      res.writeHead(200);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const webhookPort = (server.address() as AddressInfo).port;
  const webhookUrl = `http://127.0.0.1:${webhookPort}/webhook`;

  try {
    // Create an API key.
    await page.getByRole("link", { name: "Developer", exact: true }).click();
    await expect(page.getByTestId("developer-page")).toBeVisible();
    await page.getByTestId("api-key-new-name").fill("CI pipeline");
    const keyCreated = page.waitForResponse((res) => res.url().includes("apiKey.create"));
    await page.getByTestId("api-key-create").click();
    await keyCreated;
    const apiKey = await page.getByTestId("revealed-key").locator("input").inputValue();
    expect(apiKey).toMatch(/^cnv_[0-9a-f]{48}$/);

    // Create a webhook subscribed to status changes.
    await page.getByTestId("webhook-new-url").fill(webhookUrl);
    await page.getByTestId("webhook-event-task.status_changed").check();
    const webhookCreated = page.waitForResponse((res) => res.url().includes("webhook.create"));
    await page.getByTestId("webhook-create").click();
    await webhookCreated;
    const secret = (await page.getByTestId("webhook-secret").textContent())
      ?.replace("secret: ", "")
      .trim();
    if (!secret) throw new Error("Could not read the webhook secret from the UI");

    // Use the key to create a task through the public REST API.
    const createResponse = await request.post(`${API_ORIGIN}/api/v1/tasks`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { listId, title: "Created via API" },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { data: { id: string; title: string } };
    expect(created.data.title).toBe("Created via API");

    // An invalid key is rejected.
    const unauthorized = await request.post(`${API_ORIGIN}/api/v1/tasks`, {
      headers: { Authorization: "Bearer cnv_not_a_real_key" },
      data: { listId, title: "Should not be created" },
    });
    expect(unauthorized.status()).toBe(401);

    // The API-created task shows up in the real UI — proves activity/
    // automations/realtime all fired the same way a UI-created task's would.
    await page.getByRole("link", { name: "Sprint" }).click();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(page.getByRole("button", { name: "Created via API" })).toBeVisible({
      timeout: 10_000,
    });

    // Move it to Done through the UI — this is the event the webhook is
    // subscribed to.
    await page.getByRole("button", { name: "Created via API" }).click();
    const panel = page.getByTestId("task-detail-panel");
    const statusUpdated = page.waitForResponse((res) => res.url().includes("task.update"));
    await panel.getByLabel("Status").selectOption({ label: "Done" });
    await statusUpdated;

    // The webhook worker delivers asynchronously — poll briefly for it.
    await expect.poll(() => received.length, { timeout: 10_000 }).toBeGreaterThan(0);

    const delivery = received[0]!;
    expect(delivery.event).toBe("task.status_changed");
    const expectedSignature = createHmac("sha256", secret).update(delivery.body).digest("hex");
    expect(delivery.signature).toBe(expectedSignature);
    const payload = JSON.parse(delivery.body) as { taskId: string; statusKind: string };
    expect(payload.taskId).toBe(created.data.id);
    expect(payload.statusKind).toBe("done");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
