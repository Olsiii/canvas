import { db, schema } from "@canvas/db";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createWorkspaceAndOpen, signUp, uniqueEmail } from "./helpers";

test("M3.9: unread notifications get batched into a digest and the cursor advances each cycle", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const email = uniqueEmail("digest");
  await signUp(page, "Digest Tester", email);
  await createWorkspaceAndOpen(page, "Digest Workspace");
  const workspaceIdFromUrl = page.url().split("/w/")[1];
  if (!workspaceIdFromUrl) throw new Error("Could not read workspaceId from the URL");
  const workspaceId: string = workspaceIdFromUrl;

  const foundUser = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!foundUser) throw new Error("User not found");
  const userId = foundUser.id;
  expect(foundUser.lastDigestSentAt).toBeNull();

  // A notification created directly (self-authored, mirroring M3.5's
  // reminder.fired self-notify pattern) rather than chaining through the
  // reminder/@mention UI flow — deterministic, and exercises the digest
  // tick in isolation from whichever feature happens to create a
  // notification in production.
  async function insertNotification() {
    const [activityRow] = await db
      .insert(schema.activity)
      .values({
        workspaceId,
        actorId: userId,
        entityType: "task",
        entityId: userId,
        verb: "comment.created",
      })
      .returning();
    if (!activityRow) throw new Error("Failed to insert activity row");
    await db.insert(schema.notifications).values({ userId, activityId: activityRow.id });
  }

  async function lastDigestSentAt(): Promise<number | null> {
    const refreshed = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    return refreshed?.lastDigestSentAt?.getTime() ?? null;
  }

  await insertNotification();

  // The cursor starts null (always due), so the very next tick should
  // digest this notification and advance it.
  await expect.poll(async () => (await lastDigestSentAt()) != null, { timeout: 20_000 }).toBe(true);

  const firstDigestAt = await lastDigestSentAt();

  // A second notification, created after the first digest — a later tick
  // (DIGEST_INTERVAL_MS=3000 for this webServer, see playwright.config.ts)
  // should pick it up and advance the cursor again, proving this isn't a
  // one-shot and the "since last digest" window actually moves forward.
  await insertNotification();

  await expect
    .poll(async () => ((await lastDigestSentAt()) ?? 0) > (firstDigestAt ?? 0), {
      timeout: 20_000,
    })
    .toBe(true);
});
