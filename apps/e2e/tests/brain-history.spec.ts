import { expect, test } from "@playwright/test";
import { createWorkspaceAndOpen, signUp } from "./helpers";

test("Brain history: new conversation, browse past ones, switch back, delete", async ({ page }) => {
  test.setTimeout(60_000);

  await signUp(page, "Brain History Tester");
  await createWorkspaceAndOpen(page, "Brain History Workspace");

  await page.getByRole("button", { name: "Open Brain" }).click();
  const brain = page.getByTestId("brain-chat-panel");
  await expect(brain.getByRole("heading", { name: "Brain", exact: true })).toBeVisible();

  const firstPrompt = "First conversation message";
  await brain.getByTestId("brain-message-input").fill(firstPrompt);
  await brain.getByRole("button", { name: "Send" }).click();
  await expect(brain.getByText(`You said: "${firstPrompt}"`, { exact: false })).toBeVisible({
    timeout: 20_000,
  });

  // Starting a new conversation clears the view — the first message is no
  // longer shown, but it isn't gone, just no longer the active thread.
  await brain.getByTestId("brain-new-conversation").click();
  await expect(brain.getByText(firstPrompt, { exact: true })).toHaveCount(0);

  const secondPrompt = "Second conversation message";
  await brain.getByTestId("brain-message-input").fill(secondPrompt);
  await brain.getByRole("button", { name: "Send" }).click();
  await expect(brain.getByText(`You said: "${secondPrompt}"`, { exact: false })).toBeVisible({
    timeout: 20_000,
  });

  // History shows the first (now inactive) conversation, previewed by its
  // first message.
  await brain.getByTestId("brain-history-toggle").click();
  const historyList = brain.getByTestId("brain-history-list");
  await expect(historyList).toContainText(firstPrompt);
  await expect(historyList).toContainText(secondPrompt);

  // Switching to the historical one shows its own messages again.
  await historyList.getByText(firstPrompt, { exact: true }).click();
  await expect(brain.getByText(firstPrompt, { exact: true })).toBeVisible();
  await expect(brain.getByText(secondPrompt, { exact: true })).toHaveCount(0);

  // Deleting the conversation currently open removes it from history and
  // leaves the panel on a fresh, empty conversation rather than erroring —
  // which means the history panel itself closes (brain-chat-panel.tsx's
  // deleteConversation.onSuccess starts a new conversation and sets
  // showHistory false), unmounting `historyList`. Asserting directly on
  // `historyList` right after the click races that unmount and fails
  // deterministically once the panel finishes closing — not what's being
  // tested here. Reopening history and checking the stable `brain`
  // container instead (below) verifies the same thing without the race.
  await brain.getByTestId("brain-history-toggle").click();
  await expect(historyList).toContainText(firstPrompt);
  const firstRow = historyList
    .locator("[data-testid^='brain-history-item-']")
    .filter({ hasText: firstPrompt });
  await firstRow.getByLabel("Delete conversation").click();

  // Deleting the active conversation kicks off an internal "start a fresh
  // conversation" mutation that closes the history panel once *it*
  // resolves — a separate round trip after the delete itself. Wait for
  // that close instead of racing it with an immediate re-toggle (fast and
  // reliable in isolation, but flaky under full-suite parallel load).
  await expect(historyList).toHaveCount(0);

  // Reopen and confirm the deleted conversation is gone while the
  // untouched one is still there.
  await brain.getByTestId("brain-history-toggle").click();
  await expect(historyList).toContainText(secondPrompt);
  await expect(historyList).not.toContainText(firstPrompt);
});
