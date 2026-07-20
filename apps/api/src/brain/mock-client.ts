import type { ChatClient, ChatMessage } from "./types";

const WORD_DELAY_MS = 20;

// Selected by index.ts's getChatClient() whenever ANTHROPIC_API_KEY is
// unset (this environment, right now) — deterministic (same last-user-text
// -> same reply) so the rest of the pipeline (queue, worker, WS streaming,
// persistence, metering) is fully real and testable today. See
// PROGRESS.md (M2.2 decisions).
export class MockChatClient implements ChatClient {
  readonly provider = "mock";
  readonly model = "mock-echo";

  async *streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const reply = `You said: "${lastUser?.text ?? ""}". This is a placeholder reply — no ANTHROPIC_API_KEY is configured yet.`;

    for (const word of reply.split(" ")) {
      await new Promise((resolve) => setTimeout(resolve, WORD_DELAY_MS));
      yield `${word} `;
    }
  }
}
