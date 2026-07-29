export type CopyAttachment = {
  id: string;
  fileName: string;
  mime: string;
};

// Reuses the existing Generate/Brain reference-upload endpoint — a
// Copywriter frame is just another workspace-scoped attachment, no
// dedicated upload route needed.
export async function uploadCopyAttachment(
  workspaceId: string,
  file: File | Blob,
  fileName: string,
): Promise<CopyAttachment> {
  const body = new FormData();
  body.append("workspaceId", workspaceId);
  body.append("file", file, fileName);
  const res = await fetch("/ai-references/upload", {
    method: "POST",
    body,
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as CopyAttachment;
}

export function base64ToBlob(base64: string, mime = "image/jpeg"): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}
