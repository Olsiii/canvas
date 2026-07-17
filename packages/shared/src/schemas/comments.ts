import { z } from "zod";
import { REACTION_EMOJIS } from "../reactions";

export const listCommentsSchema = z.object({
  taskId: z.string().uuid(),
});

export const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  // A reply's parent. Threading is capped at depth 2 (a reply cannot itself
  // be replied to) — enforced server-side, not by this schema.
  parentCommentId: z.string().uuid().optional(),
  // TipTap document JSON — never an HTML string. Mentioned users are
  // extracted server-side from the document's mention nodes, not passed
  // separately, so notifications always match what the comment actually says.
  bodyJson: z.unknown(),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export const addReactionSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const removeReactionSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});
