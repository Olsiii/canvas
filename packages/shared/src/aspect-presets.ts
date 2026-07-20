// ARCHITECTURE.md's ImageEngine interface takes `size: AspectPreset`. The
// real preset list (and any UI picker) is M2.4's job (Generation UX) — this
// is just the minimal set M2.1's plumbing needs to exist and be typed.
export const ASPECT_PRESETS = ["square", "portrait", "landscape"] as const;
export type AspectPreset = (typeof ASPECT_PRESETS)[number];
