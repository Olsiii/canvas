export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Provider-agnostic outbound email. No CLAUDE.md-prescribed path for this
// the way ImageEngine has one (apps/api/src/image-engine/) — mirrors that
// structure (types + client(s) + a selector in index.ts) for the same
// "swap the transport without touching callers" shape the Brain chat
// client (apps/api/src/brain/) already uses.
export interface EmailClient {
  send(message: EmailMessage): Promise<void>;
}
