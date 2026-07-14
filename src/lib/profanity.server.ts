// Compatibility shim over the shared moderation engine.
// New code should call `moderateOrThrow` from `@/lib/moderation/service.server`
// which also logs events and enforces cooldowns. This file keeps existing
// call sites (guest applications, collab publish, etc.) working while
// upgrading them to the shared server-side lexicon.

import { check, compileMatcher, type Lexicon, type LexiconTerm } from "./moderation/engine";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let CACHE: { matcher: ReturnType<typeof compileMatcher>; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadMatcher() {
  const now = Date.now();
  if (CACHE && now - CACHE.loadedAt < CACHE_TTL_MS) return CACHE.matcher;
  const [{ data: v }, { data: terms }] = await Promise.all([
    supabaseAdmin.from("moderation_lexicon_version").select("version").eq("id", 1).maybeSingle(),
    supabaseAdmin
      .from("moderation_terms")
      .select("id, term, kind, severity, category, enabled")
      .eq("enabled", true),
  ]);
  const lex: Lexicon = { version: Number(v?.version ?? 0), terms: (terms ?? []) as LexiconTerm[] };
  CACHE = { matcher: compileMatcher(lex), loadedAt: now };
  return CACHE.matcher;
}

/**
 * Returns a generic "hit" token when text contains block-severity slurs,
 * else null. Kept synchronous-looking for backward compat via top-level
 * awaits at call sites — but call sites should be async.
 *
 * The returned string is intentionally opaque: never echo it back to users.
 */
export async function findHateSlurAsync(text: string | null | undefined): Promise<string | null> {
  if (!text) return null;
  const m = await loadMatcher();
  const r = check(text, m);
  if (!r.ok && r.severity === "block") return "blocked";
  return null;
}

// Synchronous stub retained ONLY so old imports don't crash if a caller was
// still sync. Prefer findHateSlurAsync or moderateOrThrow. This synchronous
// version can only see a small local fallback (no DB access), matching the
// original hardcoded behavior for the worst English slurs; migrate call sites.
const FALLBACK_SLURS = [
  "nigger","nigga","chink","gook","spic","kike","faggot","tranny","retard",
  "raghead","towelhead","paki","coon","kys",
];
function normalizeFallback(s: string) {
  return s.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
    .replace(/\$/g, "s").replace(/@/g, "a")
    .replace(/[\s._\-*+]+/g, "");
}
export function findHateSlur(text: string | null | undefined): string | null {
  if (!text) return null;
  const h = normalizeFallback(text);
  for (const s of FALLBACK_SLURS) if (h.includes(s)) return "blocked";
  return null;
}
