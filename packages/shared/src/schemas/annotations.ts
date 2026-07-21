import { z } from "zod";

export const listAnnotationsSchema = z.object({
  versionId: z.string().uuid(),
});

const pct = z.number().min(0).max(100);

export const createAnnotationSchema = z.object({
  versionId: z.string().uuid(),
  taskId: z.string().uuid(),
  x: pct,
  y: pct,
  // TipTap document JSON — never an HTML string. The comment this
  // annotation pins.
  bodyJson: z.unknown(),
});
