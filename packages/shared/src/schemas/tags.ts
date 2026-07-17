import { z } from "zod";

export const listTagsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createTagSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(20),
});

export const deleteTagSchema = z.object({
  tagId: z.string().uuid(),
});

export const addTaskTagSchema = z.object({
  taskId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export const removeTaskTagSchema = z.object({
  taskId: z.string().uuid(),
  tagId: z.string().uuid(),
});
