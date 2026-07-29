import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for a real bug: Brain's generate_image/edit_image
// tools called processImageJob directly, bypassing the same
// assertAiQuota("generate") gate the Generate panel's imageAsset.generate/
// edit mutations use (found 2026-07-29). These tests mock everything below
// executeTool's own logic so they isolate exactly one thing: quota is
// checked, and checked *before* any image job runs.

const assertAiQuotaMock = vi.fn();
const processImageJobMock = vi.fn();
const publishBrainEventMock = vi.fn();
const logActivityMock = vi.fn();
const getMembershipRoleMock = vi.fn();

vi.mock("../lib/ai-quota", () => ({
  assertAiQuota: assertAiQuotaMock,
  AiQuotaError: class AiQuotaError extends Error {},
}));
vi.mock("../lib/image-job-processor", () => ({ processImageJob: processImageJobMock }));
vi.mock("../lib/brain-realtime", () => ({ publish: publishBrainEventMock }));
vi.mock("../lib/activity", () => ({ logActivity: logActivityMock }));
vi.mock("../lib/membership", () => ({ getMembershipRole: getMembershipRoleMock }));
vi.mock("../auth/can", () => ({ can: () => true }));
vi.mock("@canvas/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: "asset-1" }],
      }),
    }),
    query: {
      imageVersions: { findFirst: async () => ({ id: "version-1", assetId: "asset-1" }) },
      imageAssets: {
        findFirst: async () => ({ id: "asset-1", workspaceId: "workspace-1" }),
      },
    },
  },
  schema: { imageAssets: {}, imageVersions: {} },
}));

const { executeTool } = await import("./execute-tool");

const baseCtx = {
  conversationId: "conv-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  contextType: "global" as const,
  contextId: null,
  toolUseId: "tool-use-1",
};

describe("executeTool quota gating", () => {
  beforeEach(() => {
    assertAiQuotaMock.mockReset();
    processImageJobMock.mockReset();
    publishBrainEventMock.mockReset();
    logActivityMock.mockReset();
    getMembershipRoleMock.mockReset();
    getMembershipRoleMock.mockResolvedValue("member");
    processImageJobMock.mockResolvedValue({ currentVersionId: "v1", versionIds: ["v1"] });
  });

  it("generate_image checks assertAiQuota('generate') before calling processImageJob", async () => {
    assertAiQuotaMock.mockResolvedValue(undefined);

    await executeTool("generate_image", { prompt: "a cat", size: "square" }, baseCtx);

    expect(assertAiQuotaMock).toHaveBeenCalledWith("user-1", "generate");
    expect(processImageJobMock).toHaveBeenCalledTimes(1);
    const quotaCallOrder = assertAiQuotaMock.mock.invocationCallOrder[0]!;
    const jobCallOrder = processImageJobMock.mock.invocationCallOrder[0]!;
    expect(quotaCallOrder).toBeLessThan(jobCallOrder);
  });

  it("generate_image never calls processImageJob when the quota is exceeded", async () => {
    assertAiQuotaMock.mockRejectedValue(new Error("Daily image generation limit reached (20)."));

    const result = await executeTool(
      "generate_image",
      { prompt: "a cat", size: "square" },
      baseCtx,
    );

    expect(processImageJobMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      name: "generate_image",
      result: { error: "Daily image generation limit reached (20)." },
    });
  });

  it("edit_image never calls processImageJob when the quota is exceeded", async () => {
    assertAiQuotaMock.mockRejectedValue(new Error("Canvas-wide monthly AI budget reached."));

    const result = await executeTool(
      "edit_image",
      { image_version_id: "550e8400-e29b-41d4-a716-446655440000", instruction: "make it pink" },
      baseCtx,
    );

    expect(processImageJobMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      name: "edit_image",
      result: { error: "Canvas-wide monthly AI budget reached." },
    });
  });
});
