/**
 * Entity-neutral free-tag normalization.
 *
 * Shared by every Workshop primitive that carries author-written tags
 * (Work Subject/Material, Blog Subject). Deliberately knows nothing about the
 * entity it is normalizing for: callers supply the cap.
 */

export const MAX_TAG_LEN = 40;

function normalizeOne(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LEN);
  return v.length > 0 ? v : null;
}

/** Trim, collapse whitespace, dedupe case-insensitively, cap. Order preserved. */
export function normalizeTags(
  values: readonly (string | null | undefined)[],
  max: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const v = normalizeOne(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}
