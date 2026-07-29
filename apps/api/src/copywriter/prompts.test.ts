import { describe, expect, it } from "vitest";
import {
  buildSystemText,
  composeText,
  generatePrompt,
  langSpecFor,
  lengthSpecFor,
  refinePrompt,
} from "./prompts";
import type { CopyVariant } from "./types";

describe("lengthSpecFor", () => {
  it("maps each length to its own spec text", () => {
    expect(lengthSpecFor("short")).toMatch(/ONE short punchy line/);
    expect(lengthSpecFor("medium")).toMatch(/headline/);
    expect(lengthSpecFor("long")).toMatch(/hashtags/);
  });
});

describe("langSpecFor", () => {
  it("maps each language to its own instruction", () => {
    expect(langSpecFor("sq")).toMatch(/Albanian/);
    expect(langSpecFor("en")).toMatch(/English/);
    expect(langSpecFor("both")).toMatch(/BOTH/);
  });
});

describe("buildSystemText", () => {
  const brand = {
    name: "Acme",
    voice: "Bold",
    colors: "#fff, #000",
    fonts: "Poppins",
    notes: "n/a",
  };

  it("includes every brand field", () => {
    const text = buildSystemText(brand, []);
    expect(text).toContain("Acme");
    expect(text).toContain("Bold");
    expect(text).toContain("Poppins");
  });

  it("falls back to sensible defaults for missing fields", () => {
    const text = buildSystemText(
      { name: "Acme", voice: null, colors: null, fonts: null, notes: null },
      [],
    );
    expect(text).toMatch(/infer a fitting tone/);
    expect(text).toContain("not specified");
    expect(text).toContain("none");
  });

  it("appends approved examples only when present", () => {
    const without = buildSystemText(brand, []);
    expect(without).not.toContain("APPROVED COPY");

    const withExamples = buildSystemText(brand, ["Great summer, better prices."]);
    expect(withExamples).toContain("APPROVED COPY");
    expect(withExamples).toContain("Great summer, better prices.");
  });
});

describe("generatePrompt", () => {
  it("asks for a design_copy/caption pair in 'Design copy + caption' mode", () => {
    const prompt = generatePrompt({
      copyType: "Design copy + caption",
      length: "medium",
      language: "sq",
      isVideoFrames: false,
    });
    expect(prompt).toContain('"design_copy"');
    expect(prompt).toContain('"caption"');
  });

  it("asks for plain text in single-output modes", () => {
    const prompt = generatePrompt({
      copyType: "Social caption",
      length: "short",
      language: "en",
      isVideoFrames: false,
    });
    expect(prompt).toContain('fill "text"');
  });

  it("adds a sequential-frames note only for video", () => {
    const withVideo = generatePrompt({
      copyType: "Social caption",
      length: "short",
      language: "en",
      isVideoFrames: true,
    });
    const withoutVideo = generatePrompt({
      copyType: "Social caption",
      length: "short",
      language: "en",
      isVideoFrames: false,
    });
    expect(withVideo).toContain("sequential moments");
    expect(withoutVideo).not.toContain("sequential moments");
  });

  it("includes extra instructions only when given", () => {
    const withExtra = generatePrompt({
      copyType: "Social caption",
      length: "short",
      language: "en",
      isVideoFrames: false,
      extra: "mention SAVE20",
    });
    expect(withExtra).toContain("mention SAVE20");
  });
});

describe("refinePrompt", () => {
  it("keeps the pair format note for 'Design copy + caption' variants", () => {
    const prompt = refinePrompt({
      copyType: "Design copy + caption",
      length: "medium",
      language: "sq",
      variant: { label: "Bold hook", design_copy: "Hey", caption: "There" },
      instruction: "Shorter",
    });
    expect(prompt).toContain("Keep the pair format");
    expect(prompt).toContain("Shorter");
  });

  it("keeps the text-only format note for single-output variants", () => {
    const prompt = refinePrompt({
      copyType: "Social caption",
      length: "short",
      language: "en",
      variant: { label: "Bold hook", text: "Hey there" },
      instruction: "Punchier",
    });
    expect(prompt).toContain('fill "text" only');
  });
});

describe("composeText", () => {
  it("keeps an existing text field untouched", () => {
    expect(composeText({ label: "a", text: "hello" }).text).toBe("hello");
  });

  it("joins design_copy and caption when text is missing", () => {
    expect(composeText({ label: "a", design_copy: "Hey", caption: "There" }).text).toBe(
      "Hey\n\nThere",
    );
  });

  it("produces an empty string when nothing is set", () => {
    const variant: CopyVariant = { label: "a" };
    expect(composeText(variant).text).toBe("");
  });
});
