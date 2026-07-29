import { env } from "../env";
import { AnthropicChatClient } from "./anthropic-client";
import { MockChatClient } from "./mock-client";
import { OpenAIChatClient } from "./openai-client";
import type { ChatClient } from "./types";

let client: ChatClient | undefined;

// OpenAI preferred over Anthropic when both are configured — an explicit
// choice (not ARCHITECTURE.md's default) to run Brain's reasoning/tool-use
// on OpenAI's Responses API instead of Claude; see PROGRESS.md for the
// decision record. Anthropic support stays wired as a fallback (unset
// OPENAI_API_KEY, keep ANTHROPIC_API_KEY, and Brain switches back) rather
// than being removed.
export function getChatClient(): ChatClient {
  if (!client) {
    client = env.OPENAI_API_KEY
      ? new OpenAIChatClient(env.OPENAI_API_KEY)
      : env.ANTHROPIC_API_KEY
        ? new AnthropicChatClient(env.ANTHROPIC_API_KEY)
        : new MockChatClient();
  }
  return client;
}

export * from "./types";
export * from "./tools";
