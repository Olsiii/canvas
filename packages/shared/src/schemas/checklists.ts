import { z } from "zod";

export const listChecklistsSchema = z.object({
  taskId: z.string().uuid(),
});

export const createChecklistSchema = z.object({
  taskId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const deleteChecklistSchema = z.object({
  checklistId: z.string().uuid(),
});

export const createChecklistItemSchema = z.object({
  checklistId: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
});

export const updateChecklistItemSchema = z.object({
  itemId: z.string().uuid(),
  text: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
});

export const deleteChecklistItemSchema = z.object({
  itemId: z.string().uuid(),
});
