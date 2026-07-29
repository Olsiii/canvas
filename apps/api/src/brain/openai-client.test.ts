import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderMessage, StreamChunk } from "./types";
import type { ToolDefinition } from "./tools";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: createMock };
    constructor(_opts: { apiKey: string }) {
      void _opts;
    }
  },
}));

const { OpenAIChatClient, mapStopReason, toResponsesInput, toResponsesTools } =
  await import("./openai-client");

function fakeStream(events: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e;
    },
  };
}

async function collect(
  client: InstanceType<typeof OpenAIChatClient>,
  messages: ProviderMessage[],
  tools: ToolDefinition[] = [],
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of client.streamChat({ messages, systemPrompt: "sys", tools })) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("OpenAIChatClient", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("reports openai / gpt-5.6", () => {
    const client = new OpenAIChatClient("test-key");
    expect(client.provider).toBe("openai");
    expect(client.model).toBe("gpt-5.6");
  });

  it("streams text deltas and ends with end_turn on a completed response", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        { type: "response.output_text.delta", delta: "Hello " },
        { type: "response.output_text.delta", delta: "world" },
        { type: "response.completed", response: { status: "completed" } },
      ]),
    );

    const client = new OpenAIChatClient("test-key");
    const chunks = await collect(client, [{ role: "user", text: "hi" }]);

    expect(chunks).toEqual([
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
      { type: "message_stop", stopReason: "end_turn" },
    ]);
  });

  it("yields tool_use when a function_call output item completes, and stops with tool_use", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        {
          type: "response.output_item.done",
          item: {
            type: "function_call",
            call_id: "call_1",
            name: "generate_image",
            arguments: '{"prompt":"a cat","size":"square"}',
          },
        },
        { type: "response.completed", response: { status: "completed" } },
      ]),
    );

    const client = new OpenAIChatClient("test-key");
    const chunks = await collect(client, [{ role: "user", text: "draw a cat" }]);

    expect(chunks).toEqual([
      {
        type: "tool_use",
        id: "call_1",
        name: "generate_image",
        input: { prompt: "a cat", size: "square" },
      },
      { type: "message_stop", stopReason: "tool_use" },
    ]);
  });

  it("ignores non-function_call output items on response.output_item.done", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        { type: "response.output_item.done", item: { type: "message" } },
        { type: "response.completed", response: { status: "completed" } },
      ]),
    );

    const client = new OpenAIChatClient("test-key");
    const chunks = await collect(client, [{ role: "user", text: "hi" }]);
    expect(chunks).toEqual([{ type: "message_stop", stopReason: "end_turn" }]);
  });

  it("tolerates malformed function-call arguments JSON", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        {
          type: "response.output_item.done",
          item: { type: "function_call", call_id: "call_1", name: "generate_image", arguments: "" },
        },
        { type: "response.completed", response: { status: "completed" } },
      ]),
    );

    const client = new OpenAIChatClient("test-key");
    const chunks = await collect(client, [{ role: "user", text: "hi" }]);
    expect(chunks[0]).toEqual({
      type: "tool_use",
      id: "call_1",
      name: "generate_image",
      input: {},
    });
  });

  it("sends the system prompt, mapped input, and mapped tools to responses.create", async () => {
    createMock.mockResolvedValue(
      fakeStream([{ type: "response.completed", response: { status: "completed" } }]),
    );

    const tools: ToolDefinition[] = [
      {
        name: "generate_image",
        description: "desc",
        input_schema: { type: "object", properties: {} },
      },
    ];
    const client = new OpenAIChatClient("test-key");
    await collect(client, [{ role: "user", text: "hi" }], tools);

    expect(createMock).toHaveBeenCalledTimes(1);
    const body = createMock.mock.calls[0]![0];
    expect(body).toMatchObject({
      model: "gpt-5.6",
      instructions: "sys",
      stream: true,
      input: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", name: "generate_image", description: "desc", strict: false }],
    });
  });
});

describe("toResponsesInput", () => {
  it("maps a plain user message to a string-content input item", () => {
    expect(toResponsesInput([{ role: "user", text: "hello" }])).toEqual([
      { role: "user", content: "hello" },
    ]);
  });

  it("maps a user message with images to input_image + input_text content parts", () => {
    const out = toResponsesInput([
      {
        role: "user",
        text: "what is this",
        images: [{ mediaType: "image/png", data: "AAAA" }],
      },
    ]);
    expect(out).toEqual([
      {
        role: "user",
        content: [
          { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "auto" },
          { type: "input_text", text: "what is this" },
        ],
      },
    ]);
  });

  it("splits an assistant message with tool calls into a text item plus sibling function_call items", () => {
    const out = toResponsesInput([
      {
        role: "assistant",
        text: "Sure, generating now.",
        toolCalls: [{ id: "call_1", name: "generate_image", input: { prompt: "a cat" } }],
      },
    ]);
    expect(out).toEqual([
      { role: "assistant", content: "Sure, generating now." },
      {
        type: "function_call",
        call_id: "call_1",
        name: "generate_image",
        arguments: '{"prompt":"a cat"}',
      },
    ]);
  });

  it("maps a tool result message to a function_call_output item keyed by call_id", () => {
    const out = toResponsesInput([
      { role: "tool", toolUseId: "call_1", name: "generate_image", result: { assetId: "abc" } },
    ]);
    expect(out).toEqual([
      { type: "function_call_output", call_id: "call_1", output: '{"assetId":"abc"}' },
    ]);
  });
});

describe("toResponsesTools", () => {
  it("maps ToolDefinition to a non-strict OpenAI FunctionTool", () => {
    const out = toResponsesTools([
      {
        name: "summarize_thread",
        description: "Summarize a task's comment thread",
        input_schema: { type: "object", properties: {} },
      },
    ]);
    expect(out).toEqual([
      {
        type: "function",
        name: "summarize_thread",
        description: "Summarize a task's comment thread",
        parameters: { type: "object", properties: {} },
        strict: false,
      },
    ]);
  });
});

describe("mapStopReason", () => {
  it("prioritizes a function call over status", () => {
    expect(mapStopReason(true, "completed", undefined)).toBe("tool_use");
    expect(mapStopReason(true, undefined, undefined)).toBe("tool_use");
  });

  it("maps a max_output_tokens incomplete response to max_tokens", () => {
    expect(mapStopReason(false, "incomplete", "max_output_tokens")).toBe("max_tokens");
  });

  it("maps a completed response with no function call to end_turn", () => {
    expect(mapStopReason(false, "completed", undefined)).toBe("end_turn");
  });

  it("falls back to other for anything else (failed, unknown status)", () => {
    expect(mapStopReason(false, "failed", undefined)).toBe("other");
    expect(mapStopReason(false, undefined, undefined)).toBe("other");
  });
});
