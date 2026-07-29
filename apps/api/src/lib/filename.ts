const MAX_KEY_FILENAME_LENGTH = 200;

/**
 * Makes a user-supplied filename safe to embed in an S3 object key.
 * Strips any directory components (so `../../etc/passwd` can't escape the
 * intended prefix), replaces everything outside a safe charset with `_`,
 * and collapses leading dots (so a stray `.` can't be combined with a
 * sibling path segment to walk upward). Storage keys built as
 * `prefix/${id}/${sanitizeFilenameForKey(name)}` stay confined to `prefix/${id}/`.
 */
export function sanitizeFilenameForKey(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
  const trimmed = safe.slice(0, MAX_KEY_FILENAME_LENGTH);
  return trimmed || "file";
}

/** Strips characters that would break a Content-Disposition header value. */
export function sanitizeForHeader(fileName: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping control chars from a header value
  return fileName.replace(/["\r\n\x00-\x1f]/g, "");
}
