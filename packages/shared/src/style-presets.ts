// M2.4 Generation UX style presets — free-form string on ImageEngine, but
// the UI offers a fixed short list so workers get consistent labels.
export const STYLE_PRESETS = ["photorealistic", "illustration", "flat", "3d"] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];

export const STYLE_PRESET_LABELS: Record<StylePreset, string> = {
  photorealistic: "Photorealistic",
  illustration: "Illustration",
  flat: "Flat design",
  "3d": "3D render",
};
