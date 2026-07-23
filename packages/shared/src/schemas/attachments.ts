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

// M5.6: attaching a Google Drive file by its share link (see PROGRESS.md
// — the "picker" widget itself needs frontend-exposed OAuth/API-key
// plumbing this repo doesn't have yet; this is the always-available path,
// and the one the real Picker would feed into once configured). A plain
// tRPC mutation, unlike upload — no file bytes cross the wire, just the
// Drive file's own metadata.
export const attachExternalSchema = z.object({
  taskId: z.string().uuid(),
  url: z.string().trim().url(),
  fileName: z.string().trim().min(1).max(300),
  mime: z.string().trim().min(1).max(200).optional(),
});
