export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// Provider-agnostic Brain chat client. No CLAUDE.md-prescribed path for
// this the way ImageEngine has one (apps/api/src/image-engine/) — this
// mirrors that structure for consistency (types + adapter(s) + a selector
// in index.ts) since it's the same "swap the provider without touching
// callers" shape.
export interface ChatClient {
  readonly provider: string;
  readonly model: string;
  streamChat(messages: ChatMessage[], systemPrompt: string): AsyncGenerator<string>;
}
