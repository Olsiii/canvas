// A fixed emoji set rather than a free-form picker — keeps reactions simple
// and validated server-side instead of accepting arbitrary strings.
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
