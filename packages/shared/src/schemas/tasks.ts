import { z } from "zod";
import { STATUS_KINDS } from "../statuses";

export const listStatusesSchema = z.object({
  listId: z.string().uuid(),
});

export const createStatusSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(20),
  kind: z.enum(STATUS_KINDS),
});

export const updateStatusSchema = z.object({
  statusId: z.string().uuid(),
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().trim().min(1).max(20).optional(),
});

export const deleteStatusSchema = z.object({
  statusId: z.string().uuid(),
});

export const listTasksSchema = z.object({
  listId: z.string().uuid(),
});

export const createTaskSchema = z.object({
  listId: z.string().uuid(),
  statusId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(500),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  statusId: z.string().uuid().optional(),
});

export const deleteTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
