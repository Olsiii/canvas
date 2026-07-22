import { z } from "zod";

export const listApiKeysSchema = z.object({ workspaceId: z.string().uuid() });

export const createApiKeySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const deleteApiKeySchema = z.object({ apiKeyId: z.string().uuid() });
