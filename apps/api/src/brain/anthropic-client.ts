import Anthropic from "@anthropic-ai/sdk";
import type { ChatClient, ChatMessage } from "./types";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 4096;

// Implemented but not live-tested — no ANTHROPIC_API_KEY is available in
// this environment, same gap M0.2 hit with Google OAuth ("implemented but
// not live-tested... degrades gracefully"). index.ts's getChatClient()
// only constructs this once a key is actually set; MockChatClient is what
// runs today. See PROGRESS.md (M2.2 decisions).
export class AnthropicChatClient implements ChatClient {
  readonly provider = "anthropic";
  readonly model = MODEL;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamChat(messages: ChatMessage[], systemPrompt: string): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
