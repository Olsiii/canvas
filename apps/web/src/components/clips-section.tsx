import { Section } from "@/components/detail-field";
import { useAttachmentUpload } from "@/hooks/use-attachment-upload";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";

/**
 * M4.6 "Clips (screen recording upload)". Reuses the `attachments` table
 * as-is (DATA_MODEL.md has no separate clips table, and `mime` already
 * tells video apart from everything else) — this is purely a
 * video-filtered, video-playing view over the same per-task attachment
 * list AttachmentsSection renders, same shape as M4.4's annotations
 * reusing `comments` instead of inventing a parallel concept. Uploads go
 * straight to storage (see use-attachment-upload.ts) rather than through
 * the API, since screen recordings are exactly the kind of large file
 * that shouldn't be buffered whole in server memory.
 */
export function ClipsSection({ taskId }: { taskId: string }) {
  const utils = trpc.useUtils();
  const attachments = trpc.attachment.list.useQuery({ taskId });
  const invalidate = () => utils.attachment.list.invalidate({ taskId });
  const del = trpc.attachment.delete.useMutation({ onSuccess: invalidate });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { uploadFile, progress } = useAttachmentUpload();

  const clips = (attachments.data ?? []).filter((a) => a.mime.startsWith("video/"));

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(fileList)) {
        await uploadFile(file, { taskId });
      }
      invalidate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Section label={`Clips${clips.length ? ` (${clips.length})` : ""}`}>
      <div className="space-y-2">
        {clips.length > 0 && (
          <div className="space-y-2">
            {clips.map((clip) => (
              <div key={clip.id} className="group space-y-1">
                <video
                  controls
                  preload="metadata"
                  src={`/uploads/${clip.id}`}
                  aria-label={clip.fileName}
                  data-testid={`clip-video-${clip.id}`}
                  className="border-border max-h-64 w-full rounded-md border bg-black"
                />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground truncate text-xs">{clip.fileName}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${clip.fileName}`}
                    title={`Delete ${clip.fileName}`}
                    onClick={() => del.mutate({ attachmentId: clip.id })}
                    className="text-muted-foreground hover:text-foreground hidden shrink-0 text-xs group-hover:inline"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            aria-label="Upload clip"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="text-muted-foreground text-xs"
          />
          {uploading && (
            <span className="text-muted-foreground text-xs">
              {Object.values(progress)[0] !== undefined
                ? `Uploading… ${Object.values(progress)[0]}%`
                : "Uploading…"}
            </span>
          )}
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>
    </Section>
  );
}
