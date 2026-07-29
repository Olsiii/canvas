// Mime types safe to serve with Content-Disposition: inline. Anything not
// in this list is forced to `application/octet-stream` + attachment
// disposition regardless of the caller's own `?download` query param —
// user uploads carry an attacker-controlled mimetype (the multipart
// Content-Type header is client-supplied, not verified against file
// contents), so serving it back inline with that same claimed type is a
// stored-XSS vector (e.g. uploading `text/html` or `image/svg+xml` with an
// embedded <script>, then having a victim open the file's direct URL).
// Deliberately excludes image/svg+xml and any text/html-adjacent type even
// though "image/*" would otherwise suggest svg belongs here — SVG can
// execute script when navigated to directly (not when used in an <img>,
// but the raw attachment URL can be opened as a top-level document).
const INLINE_SAFE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "text/plain",
]);

export function isInlineSafeMimeType(mime: string): boolean {
  return INLINE_SAFE_MIME_TYPES.has(mime.toLowerCase());
}

/** The Content-Type to actually send — the real type if safe to render inline, else a neutral download type. */
export function safeContentType(mime: string): string {
  return isInlineSafeMimeType(mime) ? mime : "application/octet-stream";
}
