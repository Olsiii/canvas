import Anthropic from "@anthropic-ai/sdk";
import type { ChatClient, ProviderMessage, StreamChunk } from "./types";
import type { ToolDefinition } from "./tools";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 4096;

function toAnthropicMessages(messages: ProviderMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
      continue;
    }
    if (m.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const call of m.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: (call.input ?? {}) as Record<string, unknown>,
        });
      }
      if (content.length === 0) content.push({ type: "text", text: "" });
      out.push({ role: "assistant", content });
      continue;
    }
    // tool → user message with tool_result (Anthropic API convention)
    out.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: m.toolUseId,
          content: JSON.stringify(m.result),
        },
      ],
    });
  }

  return out;
}

function mapStopReason(reason: string | null): "end_turn" | "tool_use" | "max_tokens" | "other" {
  if (reason === "end_turn") return "end_turn";
  if (reason === "tool_use") return "tool_use";
  if (reason === "max_tokens") return "max_tokens";
  return "other";
}

// Implemented but not live-tested — no ANTHROPIC_API_KEY is available in
// this environment, same gap M0.2 hit with Google OAuth. index.ts only
// constructs this once a key is set; MockChatClient runs today.
export class AnthropicChatClient implements ChatClient {
  readonly provider = "anthropic";
  readonly model = MODEL;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamChat(args: {
    messages: ProviderMessage[];
    systemPrompt: string;
    tools: ToolDefinition[];
  }): AsyncGenerator<StreamChunk> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: args.systemPrompt,
      messages: toAnthropicMessages(args.messages),
      tools: args.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    });

    let currentTool: { id: string; name: string; inputJson: string } | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        currentTool = {
          id: event.content_block.id,
          name: event.content_block.name,
          inputJson: "",
        };
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "input_json_delta" &&
        currentTool
      ) {
        currentTool.inputJson += event.delta.partial_json;
      } else if (event.type === "content_block_stop" && currentTool) {
        let input: unknown = {};
        try {
          input = currentTool.inputJson ? JSON.parse(currentTool.inputJson) : {};
        } catch {
          input = {};
        }
        yield {
          type: "tool_use",
          id: currentTool.id,
          name: currentTool.name,
          input,
        };
        currentTool = null;
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      } else if (event.type === "message_delta" && event.delta.stop_reason) {
        yield { type: "message_stop", stopReason: mapStopReason(event.delta.stop_reason) };
      }
    }

    // Ensure a stop event if the stream ended without message_delta
    // (defensive — finalMessage covers the usual case).
    const final = await stream.finalMessage();
    if (final.stop_reason) {
      yield { type: "message_stop", stopReason: mapStopReason(final.stop_reason) };
    }
  }
}
