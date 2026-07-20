// ARCHITECTURE.md's ImageEngine interface takes `size: AspectPreset`.
// Generation UX (M2.4) exposes these three in the prompt panel.
export const ASPECT_PRESETS = ["square", "portrait", "landscape"] as const;
export type AspectPreset = (typeof ASPECT_PRESETS)[number];

export const ASPECT_PRESET_LABELS: Record<AspectPreset, string> = {
  square: "Square",
  portrait: "Portrait",
  landscape: "Landscape",
};
