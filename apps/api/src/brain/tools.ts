import { ASPECT_PRESETS, type AspectPreset } from "@canvas/shared";
import { z } from "zod";

export const TOOL_NAMES = [
  "generate_image",
  "edit_image",
  "attach_to_task",
  "summarize_thread",
  "critique_image",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const generateImageInputSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  size: z.enum(ASPECT_PRESETS).default("square"),
});

export const editImageInputSchema = z.object({
  image_version_id: z.string().uuid(),
  instruction: z.string().trim().min(1).max(4000),
  size: z.enum(ASPECT_PRESETS).optional(),
});

export const attachToTaskInputSchema = z.object({
  image_asset_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
});

export const summarizeThreadInputSchema = z.object({
  task_id: z.string().uuid().optional(),
});

export const critiqueImageInputSchema = z.object({
  image_version_id: z.string().uuid(),
});

export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;
export type EditImageInput = z.infer<typeof editImageInputSchema>;
export type AttachToTaskInput = z.infer<typeof attachToTaskInputSchema>;
export type SummarizeThreadInput = z.infer<typeof summarizeThreadInputSchema>;
export type CritiqueImageInput = z.infer<typeof critiqueImageInputSchema>;

export type ToolDefinition = {
  name: ToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

// ROADMAP M2.3's four tools. ARCHITECTURE.md also lists search_workspace —
// deferred (not on the M2.3 line). Descriptions guide the model; execution
// lives in execute-tool.ts.
export const BRAIN_TOOLS: ToolDefinition[] = [
  {
    name: "generate_image",
    description:
      "Generate a new image from a text prompt. Use when the user asks to create, generate, or draw an image.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed image generation prompt" },
        size: {
          type: "string",
          enum: [...ASPECT_PRESETS],
          description: "Aspect preset (default square)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "edit_image",
    description:
      "Edit an existing image version with a natural-language instruction. Requires image_version_id from a prior generate_image or the conversation.",
    input_schema: {
      type: "object",
      properties: {
        image_version_id: { type: "string", description: "UUID of the image version to edit" },
        instruction: { type: "string", description: "Precise edit instruction" },
        size: { type: "string", enum: [...ASPECT_PRESETS] },
      },
      required: ["image_version_id", "instruction"],
    },
  },
  {
    name: "attach_to_task",
    description:
      "Attach an image asset to a task so it appears in the task's attachments. When chatting about a task, task_id can be omitted.",
    input_schema: {
      type: "object",
      properties: {
        image_asset_id: { type: "string", description: "UUID of the image asset to attach" },
        task_id: {
          type: "string",
          description: "Task UUID; defaults to the current task context when available",
        },
      },
      required: ["image_asset_id"],
    },
  },
  {
    name: "summarize_thread",
    description:
      "Load the comment thread on a task so you can summarize it for the user. When chatting about a task, task_id can be omitted.",
    input_schema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task UUID; defaults to the current task context when available",
        },
      },
    },
  },
  {
    name: "critique_image",
    description:
      "Give design feedback on an existing image version — what would you improve? Requires image_version_id.",
    input_schema: {
      type: "object",
      properties: {
        image_version_id: { type: "string", description: "UUID of the image version to critique" },
      },
      required: ["image_version_id"],
    },
  },
];

export function parseToolInput(name: ToolName, input: unknown) {
  switch (name) {
    case "generate_image":
      return generateImageInputSchema.parse(input);
    case "edit_image":
      return editImageInputSchema.parse(input);
    case "attach_to_task":
      return attachToTaskInputSchema.parse(input);
    case "summarize_thread":
      return summarizeThreadInputSchema.parse(input);
    case "critique_image":
      return critiqueImageInputSchema.parse(input);
  }
}

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

export function isAspectPreset(value: string): value is AspectPreset {
  return (ASPECT_PRESETS as readonly string[]).includes(value);
}
