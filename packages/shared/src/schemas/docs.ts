import { z } from "zod";

export const listDocsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createDocSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).default("Untitled"),
  spaceId: z.string().uuid().nullable().optional(),
});

export const getDocSchema = z.object({
  docId: z.string().uuid(),
});

export const updateDocSchema = z.object({
  docId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

export const deleteDocSchema = z.object({
  docId: z.string().uuid(),
});

export const listDocTaskLinksSchema = z.object({
  docId: z.string().uuid(),
});

export const addDocTaskLinkSchema = z.object({
  docId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const removeDocTaskLinkSchema = z.object({
  docId: z.string().uuid(),
  taskId: z.string().uuid(),
});
