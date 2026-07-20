import { describe, expect, it } from "vitest";
import { MockChatClient } from "./mock-client";
import { BRAIN_TOOLS } from "./tools";

describe("MockChatClient tool heuristics", () => {
  const client = new MockChatClient();

  async function collect(messages: Parameters<MockChatClient["streamChat"]>[0]["messages"]) {
    const chunks = [];
    for await (const chunk of client.streamChat({
      messages,
      systemPrompt: "test",
      tools: BRAIN_TOOLS,
    })) {
      chunks.push(chunk);
    }
    return chunks;
  }

  it("echoes non-tool prompts (M2.2 path)", async () => {
    const chunks = await collect([{ role: "user", text: "hello there" }]);
    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    expect(text).toContain('You said: "hello there"');
    expect(chunks.at(-1)).toEqual({ type: "message_stop", stopReason: "end_turn" });
  });

  it("emits generate_image tool_use for generate prompts", async () => {
    const chunks = await collect([
      { role: "user", text: "Generate an image of a red square banner" },
    ]);
    const tool = chunks.find((c) => c.type === "tool_use");
    expect(tool).toMatchObject({
      type: "tool_use",
      name: "generate_image",
      input: { prompt: "a red square banner", size: "square" },
    });
    expect(chunks.at(-1)).toEqual({ type: "message_stop", stopReason: "tool_use" });
  });

  it("emits summarize_thread for summarize prompts", async () => {
    const chunks = await collect([{ role: "user", text: "Please summarize the comment thread" }]);
    expect(chunks.some((c) => c.type === "tool_use" && c.name === "summarize_thread")).toBe(true);
  });

  it("finalizes after a tool result is present", async () => {
    const chunks = await collect([
      { role: "user", text: "Generate an image of a cat" },
      {
        role: "assistant",
        text: "I'll generate that image for you. ",
        toolCalls: [{ id: "t1", name: "generate_image", input: { prompt: "a cat" } }],
      },
      {
        role: "tool",
        toolUseId: "t1",
        name: "generate_image",
        result: { assetId: "a", versionId: "v" },
      },
    ]);
    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    expect(text).toContain("generate_image completed successfully");
    expect(chunks.some((c) => c.type === "tool_use")).toBe(false);
  });
});
