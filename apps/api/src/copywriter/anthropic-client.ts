import Anthropic from "@anthropic-ai/sdk";
import { composeText, buildSystemText, generatePrompt, refinePrompt } from "./prompts";
import type {
  CopyClient,
  CopyVariant,
  GenerateCopyArgs,
  GenerateCopyResult,
  RefineCopyArgs,
  RefineCopyResult,
} from "./types";

const MODEL = "claude-opus-4-8";
const GENERATE_MAX_TOKENS = 1500;
const REFINE_MAX_TOKENS = 800;

const VARIANT_PROPS = {
  label: { type: "string", description: "Short variant name describing the angle or hook" },
  text: { type: "string", description: "The full copy text (single-output modes only)" },
  design_copy: {
    type: "string",
    description: "On-design headline, max 8 words ('Design copy + caption' mode only)",
  },
  caption: {
    type: "string",
    description: "Matching social caption ('Design copy + caption' mode only)",
  },
};

const COPY_TOOL = {
  name: "deliver_copy",
  description: "Deliver the final copy variants for the attached design.",
  input_schema: {
    type: "object" as const,
    properties: {
      design_read: {
        type: "string",
        description: "1 sentence on what's in the visual and its mood",
      },
      variants: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "object", properties: VARIANT_PROPS, required: ["label"] },
      },
    },
    required: ["design_read", "variants"],
  },
};

const REFINE_TOOL = {
  name: "deliver_variant",
  description: "Deliver the single refined copy variant.",
  input_schema: {
    type: "object" as const,
    properties: VARIANT_PROPS,
    required: ["label"],
  },
};

function imageBlocks(images: GenerateCopyArgs["images"]): Anthropic.ImageBlockParam[] {
  return images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));
}

// Implemented but not live-tested — no ANTHROPIC_API_KEY is available in
// this environment, same gap the Brain/image adapters hit. index.ts only
// constructs this once a key is set; MockCopyClient runs today.
export class AnthropicCopyClient implements CopyClient {
  readonly provider = "anthropic";
  readonly model = MODEL;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateCopy(args: GenerateCopyArgs): Promise<GenerateCopyResult> {
    const system = buildSystemText(args.brand, args.approvedExamples);
    const prompt = generatePrompt({
      copyType: args.copyType,
      length: args.length,
      language: args.language,
      isVideoFrames: args.isVideoFrames,
      extra: args.extra,
    });

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: GENERATE_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [...imageBlocks(args.images), { type: "text", text: prompt }],
        },
      ],
      tools: [COPY_TOOL],
      tool_choice: { type: "tool", name: COPY_TOOL.name },
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("No structured response from model");
    }
    const input = toolBlock.input as { design_read?: string; variants?: CopyVariant[] };
    const variants = (input.variants ?? []).map(composeText);

    return {
      designRead: input.design_read ?? "",
      variants,
      inputChars: system.length + prompt.length,
      outputChars: JSON.stringify(input).length,
    };
  }

  async refineCopy(args: RefineCopyArgs): Promise<RefineCopyResult> {
    const system = buildSystemText(args.brand, args.approvedExamples);
    const prompt = refinePrompt({
      copyType: args.copyType,
      length: args.length,
      language: args.language,
      variant: args.variant,
      instruction: args.instruction,
    });

    const content: Anthropic.ContentBlockParam[] =
      args.images.length > 0
        ? [...imageBlocks(args.images), { type: "text", text: prompt }]
        : [{ type: "text", text: prompt }];

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: REFINE_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      tools: [REFINE_TOOL],
      tool_choice: { type: "tool", name: REFINE_TOOL.name },
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("No structured response from model");
    }
    const variant = composeText(toolBlock.input as CopyVariant);

    return {
      variant,
      inputChars: system.length + prompt.length,
      outputChars: JSON.stringify(toolBlock.input).length,
    };
  }
}
