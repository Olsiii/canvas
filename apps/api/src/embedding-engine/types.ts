// Provider-agnostic text embedding — same shape/spirit as ../image-engine's
// ImageEngine (CLAUDE.md: providers live behind a typed interface, callers
// never branch on a provider name). Unlike ImageEngine, there's exactly one
// active engine system-wide rather than one per workspace: two different
// embedding models produce vectors that live in different spaces entirely,
// so a similarity search can't mix providers (see schema/embeddings.ts).
export interface EmbeddingEngine {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}
