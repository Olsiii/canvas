import { composeText } from "./prompts";
import type {
  CopyClient,
  CopyVariant,
  GenerateCopyArgs,
  GenerateCopyResult,
  RefineCopyArgs,
  RefineCopyResult,
} from "./types";

// Selected whenever ANTHROPIC_API_KEY is unset — deterministic (same brand
// + copyType always produces the same variant labels/text) so tests can
// assert on stable output, same precedent as the image adapters' seeded
// placeholders and Brain's MockChatClient.
export class MockCopyClient implements CopyClient {
  readonly provider = "mock";
  readonly model = "mock-copywriter";

  async generateCopy(args: GenerateCopyArgs): Promise<GenerateCopyResult> {
    const isBoth = args.copyType === "Design copy + caption";
    const frameNote = args.isVideoFrames ? ` (${args.images.length}-frame video)` : "";
    const designRead = `A ${args.brand.name} design${frameNote} — placeholder read, no ANTHROPIC_API_KEY configured.`;

    const angles = ["Bold hook", "Playful angle", "Direct offer"];
    const variants: CopyVariant[] = angles.map((label) =>
      composeText(
        isBoth
          ? {
              label,
              design_copy: `${args.brand.name}: ${label}`,
              caption: `${label} caption for ${args.brand.name} in ${args.language}.${
                args.extra ? ` (${args.extra})` : ""
              }`,
            }
          : {
              label,
              text: `${label} — ${args.copyType} for ${args.brand.name} in ${args.language}.${
                args.extra ? ` (${args.extra})` : ""
              }`,
            },
      ),
    );

    const outputChars = JSON.stringify({ designRead, variants }).length;
    return {
      designRead,
      variants,
      inputChars: designRead.length,
      outputChars,
    };
  }

  async refineCopy(args: RefineCopyArgs): Promise<RefineCopyResult> {
    const suffix = ` — revised: ${args.instruction}`;
    const variant: CopyVariant = composeText({
      label: args.variant.label,
      text: args.variant.text ? `${args.variant.text}${suffix}` : undefined,
      design_copy: args.variant.design_copy,
      caption: args.variant.caption ? `${args.variant.caption}${suffix}` : undefined,
    });

    return {
      variant,
      inputChars: args.instruction.length,
      outputChars: (variant.text ?? "").length,
    };
  }
}
