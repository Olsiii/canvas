import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseInputItem,
  ResponseStatus,
} from "openai/resources/responses/responses";
import type { ChatClient, ProviderMessage, StreamChunk } from "./types";
import type { ToolDefinition } from "./tools";

// GPT-5.6 Sol — OpenAI's frontier tier as of its 2026-07-09 GA (verified via
// web search at build time per CLAUDE.md's "this space moves monthly" rule;
// no fixed snapshot suffix, matching how MODEL constants read elsewhere in
// this codebase, e.g. anthropic-client.ts's "claude-opus-4-8"). Tool calling
// on this model requires the Responses API, not the older Chat Completions
// API — a materially different request/response shape from
// anthropic-client.ts's Messages API, mapped below.
const MODEL = "gpt-5.6";
const MAX_OUTPUT_TOKENS = 4096;

export function toResponsesInput(messages: ProviderMessage[]): ResponseInputItem[] {
  const out: ResponseInputItem[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      if (m.images && m.images.length > 0) {
        out.push({
          role: "user",
          content: [
            ...m.images.map((img) => ({
              type: "input_image" as const,
              image_url: `data:${img.mediaType};base64,${img.data}`,
              detail: "auto" as const,
            })),
            { type: "input_text" as const, text: m.text },
          ],
        });
      } else {
        out.push({ role: "user", content: m.text });
      }
      continue;
    }
    if (m.role === "assistant") {
      // Unlike Anthropic's content-block-per-message shape, the Responses
      // API models a prior tool call as its own flat `function_call` input
      // item, sibling to (not nested inside) the assistant's text message.
      if (m.text) out.push({ role: "assistant", content: m.text });
      for (const call of m.toolCalls ?? []) {
        out.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.input ?? {}),
        });
      }
      continue;
    }
    // tool → function_call_output, correlated back to its call by call_id
    // (this app's ToolCall.id is threaded through as call_id on both ends).
    out.push({
      type: "function_call_output",
      call_id: m.toolUseId,
      output: JSON.stringify(m.result),
    });
  }

  return out;
}

export function toResponsesTools(tools: ToolDefinition[]): FunctionTool[] {
  return tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
    // Not all of this app's tool schemas satisfy OpenAI's strict-mode
    // requirements (e.g. summarize_thread has no `required` array at all) —
    // strict: false keeps behavior equivalent to Anthropic's tool_use,
    // which has no such constraint.
    strict: false,
  }));
}

export function mapStopReason(
  sawFunctionCall: boolean,
  status: ResponseStatus | undefined,
  incompleteReason: string | undefined,
): "end_turn" | "tool_use" | "max_tokens" | "other" {
  // A function call in the output takes priority over status — the model is
  // waiting on a tool result, same as Anthropic's stop_reason: "tool_use".
  if (sawFunctionCall) return "tool_use";
  if (incompleteReason === "max_output_tokens") return "max_tokens";
  if (status === "completed") return "end_turn";
  return "other";
}

// Implemented but not live-tested against the real API in this environment
// (verified via mocked-fetch/mocked-SDK unit tests only). Selected by
// getChatClient() ahead of AnthropicChatClient whenever OPENAI_API_KEY is
// set — see index.ts for the full selection order and the note on why this
// deviates from ARCHITECTURE.md §3's Claude-only Brain design.
export class OpenAIChatClient implements ChatClient {
  readonly provider = "openai";
  readonly model = MODEL;
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *streamChat(args: {
    messages: ProviderMessage[];
    systemPrompt: string;
    tools: ToolDefinition[];
  }): AsyncGenerator<StreamChunk> {
    const stream = await this.client.responses.create({
      model: this.model,
      instructions: args.systemPrompt,
      input: toResponsesInput(args.messages),
      tools: toResponsesTools(args.tools),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
    });

    let sawFunctionCall = false;
    let finalStatus: ResponseStatus | undefined;
    let incompleteReason: string | undefined;

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        yield { type: "text", text: event.delta };
      } else if (
        event.type === "response.output_item.done" &&
        event.item.type === "function_call"
      ) {
        sawFunctionCall = true;
        let input: unknown = {};
        try {
          input = event.item.arguments ? JSON.parse(event.item.arguments) : {};
        } catch {
          input = {};
        }
        yield { type: "tool_use", id: event.item.call_id, name: event.item.name, input };
      } else if (event.type === "response.completed") {
        finalStatus = event.response.status;
      } else if (event.type === "response.incomplete") {
        finalStatus = event.response.status;
        incompleteReason = event.response.incomplete_details?.reason;
      } else if (event.type === "response.failed") {
        finalStatus = event.response.status;
      }
    }

    yield {
      type: "message_stop",
      stopReason: mapStopReason(sawFunctionCall, finalStatus, incompleteReason),
    };
  }
}
