import { z } from "zod";
import { TASK_PRIORITIES } from "../priority";
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
  // A subtask's parent. Nesting is capped at depth 2 (a subtask cannot
  // itself have subtasks) — enforced server-side, not by this schema.
  parentTaskId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  statusId: z.string().uuid().optional(),
  // Explicit position (e.g. from a board drag-and-drop drop). When omitted
  // and statusId changes, the server appends the task to the end of the
  // new status column instead.
  orderKey: z.string().min(1).optional(),
  // TipTap document JSON — never an HTML string. null clears the description.
  descriptionJson: z.unknown().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});

export const deleteTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export const getTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export const searchTasksSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().trim().min(1).max(200),
});

export const assignTaskSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const unassignTaskSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
