export const RECURRENCE_PRESETS = ["daily", "weekdays", "weekly", "monthly"] as const;
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

export const RECURRENCE_PRESET_LABELS: Record<RecurrencePreset, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

const PRESET_RRULE: Record<RecurrencePreset, string> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
};

export function presetToRRule(preset: RecurrencePreset): string {
  return PRESET_RRULE[preset];
}
