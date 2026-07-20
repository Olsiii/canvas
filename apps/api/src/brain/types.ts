export type ChatRole = "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  name: string;
  input: unknown;
};

export type ProviderMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolUseId: string; name: string; result: unknown };

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "message_stop"; stopReason: "end_turn" | "tool_use" | "max_tokens" | "other" };

export type StreamChatArgs = {
  messages: ProviderMessage[];
  systemPrompt: string;
  tools: import("./tools").ToolDefinition[];
};

// Provider-agnostic Brain chat client. No CLAUDE.md-prescribed path for
// this the way ImageEngine has one (apps/api/src/image-engine/) — this
// mirrors that structure for consistency (types + adapter(s) + a selector
// in index.ts) since it's the same "swap the provider without touching
// callers" shape.
export interface ChatClient {
  readonly provider: string;
  readonly model: string;
  streamChat(args: StreamChatArgs): AsyncGenerator<StreamChunk>;
}

/** @deprecated Prefer ProviderMessage — kept for any leftover imports. */
export type ChatMessage = { role: "user" | "assistant"; text: string };
