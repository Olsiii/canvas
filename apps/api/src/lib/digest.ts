import { NOTIFICATION_VERB_LABELS } from "@canvas/shared";

export interface DigestNotification {
  verb: string;
  actorName: string;
}

/**
 * Composes the digest email's subject/body from a user's unread
 * notifications since their last digest. Pure — no DB/network — so it's
 * unit-testable independent of the scheduler tick that calls it
 * (apps/api/src/lib/scheduler.ts).
 */
export function buildDigestEmail(
  notifications: DigestNotification[],
  webUrl: string,
): { subject: string; text: string } {
  const count = notifications.length;
  const subject = `${count} new notification${count === 1 ? "" : "s"} on Canvas`;
  const lines = notifications.map(
    (n) => `- ${n.actorName} ${NOTIFICATION_VERB_LABELS[n.verb] ?? n.verb}`,
  );
  const text = `You have ${count} new notification${count === 1 ? "" : "s"}:\n\n${lines.join("\n")}\n\nOpen Canvas: ${webUrl}`;
  return { subject, text };
}
