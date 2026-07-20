import { env } from "../env";
import { AnthropicChatClient } from "./anthropic-client";
import { MockChatClient } from "./mock-client";
import type { ChatClient } from "./types";

let client: ChatClient | undefined;

export function getChatClient(): ChatClient {
  if (!client) {
    client = env.ANTHROPIC_API_KEY ? new AnthropicChatClient(env.ANTHROPIC_API_KEY) : new MockChatClient();
  }
  return client;
}

export * from "./types";
