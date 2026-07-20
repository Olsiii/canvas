import type { AppRouter } from "@canvas/api";
import { BlurhashThumb } from "@/components/blurhash-thumb";
import { Section } from "@/components/detail-field";
import { Lightbox } from "@/components/lightbox";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useRef, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Attachment = RouterOutputs["attachment"]["list"][number];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(a: Attachment) {
  return a.mime.startsWith("image/");
}

export function AttachmentsSection({ taskId }: { taskId: string }) {
  const utils = trpc.useUtils();
  const attachments = trpc.attachment.list.useQuery({ taskId });
  const invalidate = () => utils.attachment.list.invalidate({ taskId });
  const del = trpc.attachment.delete.useMutation({ onSuccess: invalidate });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const all = attachments.data ?? [];
  const images = all.filter(isImage);
  const files = all.filter((a) => !isImage(a));

  // Plain multipart POST to the REST /uploads route, not a tRPC mutation —
  // tRPC has no file-upload transport. See PROGRESS.md (M1.9 decisions).
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("taskId", taskId);
        form.append("file", file);
        const res = await fetch("/uploads", { method: "POST", body: form, credentials: "include" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Upload failed");
        }
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
    <Section label={`Attachments${all.length ? ` (${all.length})` : ""}`}>
      <div className="space-y-2">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((a, i) => (
              <div key={a.id} className="group relative">
                <BlurhashThumb attachment={a} onClick={() => setLightboxIndex(i)} />
                <button
                  type="button"
                  aria-label={`Delete ${a.fileName}`}
                  onClick={() => del.mutate({ attachmentId: a.id })}
                  className="bg-background/90 text-muted-foreground hover:text-foreground absolute top-1 right-1 hidden rounded-full px-1.5 text-xs group-hover:inline"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((a) => (
              <div
                key={a.id}
                className="group border-border flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
              >
                <a
                  href={`/uploads/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate hover:underline"
                >
                  📎 {a.fileName}
                </a>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatBytes(a.sizeBytes)}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${a.fileName}`}
                  onClick={() => del.mutate({ attachmentId: a.id })}
                  className="text-muted-foreground hover:text-foreground hidden shrink-0 group-hover:inline"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            aria-label="Upload attachment"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="text-muted-foreground text-xs"
          />
          {uploading && <span className="text-muted-foreground text-xs">Uploading…</span>}
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </Section>
  );
}
