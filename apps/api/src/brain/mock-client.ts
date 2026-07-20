import { uuidv7 } from "uuidv7";
import type { ChatClient, ProviderMessage, StreamChunk } from "./types";
import type { ToolDefinition } from "./tools";

const WORD_DELAY_MS = 15;

async function* emitWords(text: string): AsyncGenerator<StreamChunk> {
  for (const word of text.split(" ")) {
    await new Promise((resolve) => setTimeout(resolve, WORD_DELAY_MS));
    yield { type: "text", text: `${word} ` };
  }
}

function lastUserText(messages: ProviderMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return m.text;
  }
  return "";
}

function lastToolResult(messages: ProviderMessage[]): ProviderMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "tool") return m;
  }
  return undefined;
}

function hasPendingToolUse(messages: ProviderMessage[]): boolean {
  // If the last non-tool message is an assistant with toolCalls and no
  // following tool results covering them, the next mock turn should not
  // fire tools again — the worker always appends tool results before the
  // next streamChat call, so reaching here with a trailing tool message
  // means we should produce a final text reply.
  return messages.at(-1)?.role === "tool";
}

// Selected whenever ANTHROPIC_API_KEY is unset. Keyword heuristics simulate
// tool_use so M2.3's agent loop / executors / WS status are fully testable
// without a live Claude key. Plain echo preserved for non-tool prompts so
// M2.2's Playwright spec stays green.
export class MockChatClient implements ChatClient {
  readonly provider = "mock";
  readonly model = "mock-echo";

  async *streamChat(args: {
    messages: ProviderMessage[];
    systemPrompt: string;
    tools: ToolDefinition[];
  }): AsyncGenerator<StreamChunk> {
    void args.systemPrompt;
    void args.tools;

    if (hasPendingToolUse(args.messages)) {
      const tool = lastToolResult(args.messages);
      if (!tool || tool.role !== "tool") {
        yield* emitWords("Done.");
        yield { type: "message_stop", stopReason: "end_turn" };
        return;
      }
      const result = tool.result;
      const summary =
        result && typeof result === "object" && result !== null && "error" in result
          ? `Tool ${tool.name} failed: ${String((result as { error: unknown }).error)}`
          : `Done — ${tool.name} completed successfully. ${JSON.stringify(result)}`;
      yield* emitWords(summary);
      yield { type: "message_stop", stopReason: "end_turn" };
      return;
    }

    const userText = lastUserText(args.messages);
    const lower = userText.toLowerCase();

    if (
      /\b(generate|create|draw)\b.*\b(image|banner|picture|mockup)\b/.test(lower) ||
      /\bgenerate an image\b/.test(lower)
    ) {
      const intro = "I'll generate that image for you.";
      yield* emitWords(intro);
      const promptMatch = userText.match(/(?:of|for|:)\s+(.+)$/i);
      yield {
        type: "tool_use",
        id: uuidv7(),
        name: "generate_image",
        input: {
          prompt: promptMatch?.[1]?.trim() || userText,
          size: "square",
        },
      };
      yield { type: "message_stop", stopReason: "tool_use" };
      return;
    }

    if (/\bedit\b/.test(lower) && /\b(image|version)\b/.test(lower)) {
      const versionMatch = userText.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      if (versionMatch) {
        yield* emitWords("I'll edit that image.");
        yield {
          type: "tool_use",
          id: uuidv7(),
          name: "edit_image",
          input: {
            image_version_id: versionMatch[0],
            instruction: userText,
          },
        };
        yield { type: "message_stop", stopReason: "tool_use" };
        return;
      }
    }

    if (/\battach\b/.test(lower)) {
      const assetMatch = userText.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      if (assetMatch) {
        yield* emitWords("I'll attach that image to the task.");
        yield {
          type: "tool_use",
          id: uuidv7(),
          name: "attach_to_task",
          input: { image_asset_id: assetMatch[0] },
        };
        yield { type: "message_stop", stopReason: "tool_use" };
        return;
      }
    }

    if (/\bsummarize\b/.test(lower) && /\b(thread|comment|discussion)\b/.test(lower)) {
      yield* emitWords("I'll pull the comment thread and summarize it.");
      yield {
        type: "tool_use",
        id: uuidv7(),
        name: "summarize_thread",
        input: {},
      };
      yield { type: "message_stop", stopReason: "tool_use" };
      return;
    }

    const reply = `You said: "${userText}". This is a placeholder reply — no ANTHROPIC_API_KEY is configured yet.`;
    yield* emitWords(reply);
    yield { type: "message_stop", stopReason: "end_turn" };
  }
}
