import { MODERATION_MESSAGES } from "./engine";

/**
 * Convert an arbitrary error thrown by supabase-js/postgres/server fns into
 * a user-safe moderation message when the failure is a moderation block,
 * otherwise return the original message. Never echoes the offending term.
 */
export function toModerationMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/moderation_block/i.test(msg) || /community standards/i.test(msg)) {
    return MODERATION_MESSAGES.slur;
  }
  if (/posting too fast/i.test(msg)) return msg;
  return msg;
}

export function isModerationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /moderation_block/i.test(msg) || /community standards/i.test(msg);
}
