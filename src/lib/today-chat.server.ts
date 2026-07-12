/**
 * Server-only helpers for today-chat server functions. Kept out of
 * `today-chat.functions.ts` because TanStack Start's `?tss-serverfn-split`
 * transform strips sibling module-scope declarations from the emitted
 * server-fn module, causing ReferenceError at runtime.
 */

export const BODY_MAX = 500;
export const MENTION_CAP = 10;
export const TZ_RE = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

const MENTION_RE = /(?:^|\s)@([a-zA-Z0-9_]{2,30})/g;

export function extractMentions(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(body)) !== null) {
    out.add(m[1].toLowerCase());
    if (out.size >= MENTION_CAP) break;
  }
  return Array.from(out);
}
