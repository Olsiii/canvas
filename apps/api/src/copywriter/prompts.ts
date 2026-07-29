import type { CopyLanguage, CopyLength } from "@canvas/shared";
import type { BrandVoice } from "./types";

// Ported near-verbatim from trekuartista-copy's server/src/routes/generate.js —
// pure string logic, unit-tested (see prompts.test.ts) rather than only
// exercised through a live Claude call.
export function lengthSpecFor(length: CopyLength): string {
  return {
    short:
      "ONE short punchy line only. Max 8 words. No subtext, no extra options beyond the single line.",
    medium: "A headline (3-8 words) plus one short supporting line (max 15 words).",
    long: "A full social-ready caption, 2-4 sentences, conversational, plus 3-6 relevant hashtags at the end.",
  }[length];
}

export function langSpecFor(language: CopyLanguage): string {
  return {
    sq: "Write everything in Albanian (Shqip).",
    en: "Write everything in English.",
    both: "Provide each variant in BOTH Albanian and English, clearly labeled.",
  }[language];
}

// Brand profile in the system prompt so it's prompt-cacheable per brand kit.
export function buildSystemText(brand: BrandVoice, approvedExamples: string[]): string {
  let text = `You are the dedicated copywriter for this specific brand at a creative advertising agency. You know this brand's voice intimately — write exactly as their copywriter would, not as a generic AI.

BRAND: ${brand.name}
Brand voice / personality: ${brand.voice || "not specified — infer a fitting tone from the visual and brand name"}
Brand colors: ${brand.colors || "not specified"}
Brand fonts: ${brand.fonts || "not specified"}
Additional brand notes: ${brand.notes || "none"}`;

  if (approvedExamples.length) {
    text += `

APPROVED COPY — real copy this brand's team approved and published. This is the single best reference for the brand's actual voice. Match its tone, rhythm, vocabulary, and quirks. Never reuse these lines verbatim:
${approvedExamples.map((e) => `- ${e}`).join("\n")}`;
  }

  return text;
}

export function generatePrompt(args: {
  copyType: string;
  length: CopyLength;
  language: CopyLanguage;
  isVideoFrames: boolean;
  extra?: string;
}): string {
  const isBoth = args.copyType === "Design copy + caption";
  const lengthSpec = lengthSpecFor(args.length);
  const langSpec = langSpecFor(args.language);
  const videoNote = args.isVideoFrames
    ? "These frames are sequential moments from a single video, in order — read them as a sequence showing progression, not unrelated images."
    : "";

  const task = isBoth
    ? `Write a matched PAIR for the attached design. For each variant fill "design_copy" and "caption" (leave "text" empty):
1. design_copy — the text that goes ON the visual itself (headline/tagline). Max 8 words. Must work typographically on the design: short, strong, no hashtags, no emoji.
2. caption — the social post text that accompanies the design when published. Length/format: ${lengthSpec}
The two must feel like one voice and one idea — the caption extends the design copy's hook, never repeats it word-for-word.`
    : `Write ${args.copyType.toLowerCase()} for the attached design. For each variant fill "text" (leave "design_copy" and "caption" empty).
Length/format: ${lengthSpec}`;

  return `TASK: ${task}
Language: ${langSpec}
${args.extra ? `Extra instructions for this piece: ${args.extra}` : ""}
${videoNote}

Look carefully at the visual — composition, colors, mood, any existing text, what's being shown — and write copy that feels like it was made specifically for this exact image, in this brand's authentic voice.

Give exactly 3 distinct variants with genuinely different angles or hooks — not reworded versions of each other. Deliver via the deliver_copy tool.`;
}

export function refinePrompt(args: {
  copyType: string;
  length: CopyLength;
  language: CopyLanguage;
  variant: { label: string; text?: string; design_copy?: string; caption?: string };
  instruction: string;
}): string {
  const isBoth = args.copyType === "Design copy + caption";
  const langSpec = langSpecFor(args.language);
  const lengthSpec = lengthSpecFor(args.length);

  const formatNote = isBoth
    ? `Keep the pair format: "design_copy" (on-design headline, max 8 words, no hashtags/emoji) and "caption" (${lengthSpec}). Leave "text" empty.`
    : `Keep the format: fill "text" only. Length/format: ${lengthSpec}`;

  return `You previously wrote this ${args.copyType.toLowerCase()} variant for the attached design:

${JSON.stringify(args.variant, null, 2)}

Revise it per this instruction: ${args.instruction}

${formatNote}
Language: ${langSpec}
Stay in the brand's voice. Keep what works — this is a revision, not a restart. Deliver via the deliver_variant tool.`;
}

export function composeText<T extends { text?: string; design_copy?: string; caption?: string }>(
  v: T,
): T & { text: string } {
  return { ...v, text: v.text || [v.design_copy, v.caption].filter(Boolean).join("\n\n") };
}
