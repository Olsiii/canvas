import { z } from "zod";
import { CUSTOM_FIELD_TYPES } from "../custom-fields";

export const listCustomFieldDefsSchema = z.object({
  listId: z.string().uuid(),
});

export const createCustomFieldDefSchema = z.object({
  workspaceId: z.string().uuid(),
  // Omitted = workspace-wide. The UI only ever sends the current list's id
  // — see PROGRESS.md (M1.8 decisions) — but the API supports either.
  listId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(CUSTOM_FIELD_TYPES),
  // Shape depends on `type` (e.g. `{ options: string[] }` for
  // dropdown/label) — validated server-side, not by this transport schema.
  optionsJson: z.unknown().optional(),
});

export const updateCustomFieldDefSchema = z.object({
  fieldDefId: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  optionsJson: z.unknown().optional(),
});

export const deleteCustomFieldDefSchema = z.object({
  fieldDefId: z.string().uuid(),
});

export const listCustomFieldValuesSchema = z.object({
  taskId: z.string().uuid(),
});

export const setCustomFieldValueSchema = z.object({
  fieldDefId: z.string().uuid(),
  taskId: z.string().uuid(),
  // null clears the value (deletes the row) instead of storing null.
  valueJson: z.unknown().nullable(),
});
