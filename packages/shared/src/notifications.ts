/**
 * Human-readable labels for `activity.verb` values that generate a
 * notification — shared by `NotificationsBell` (web) and the email digest
 * builder (apps/api/src/lib/digest.ts, M3.9) so the two surfaces read the
 * same way. Extracted from what was a `notifications-bell.tsx`-local map.
 */
export const NOTIFICATION_VERB_LABELS: Record<string, string> = {
  "comment.created": "mentioned you in a comment",
  "reminder.fired": "Reminder",
};
