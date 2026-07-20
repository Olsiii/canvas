import { z } from "zod";

// Upload itself is a plain multipart POST to /uploads, not a tRPC mutation
// — tRPC has no native file-upload transport. See PROGRESS.md (M1.9
// decisions).
export const listAttachmentsSchema = z.object({
  taskId: z.string().uuid(),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});
