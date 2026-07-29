import { env } from "../env";
import { AnthropicCopyClient } from "./anthropic-client";
import { MockCopyClient } from "./mock-client";
import type { CopyClient } from "./types";

let client: CopyClient | undefined;

export function getCopyClient(): CopyClient {
  if (!client) {
    client = env.ANTHROPIC_API_KEY
      ? new AnthropicCopyClient(env.ANTHROPIC_API_KEY)
      : new MockCopyClient();
  }
  return client;
}

export * from "./prompts";
export * from "./types";
