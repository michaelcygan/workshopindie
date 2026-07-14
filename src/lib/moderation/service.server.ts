// Server-only moderation service — cached lexicon, event logging, throw helper.
// Filename ends with .server.ts so import protection blocks client bundles.

import { createHash } from "crypto";
import {
  check,
  checkSpam,
  compileMatcher,
  MODERATION_MESSAGES,
  type CompiledMatcher,
  type Lexicon,
  type LexiconTerm,
  type SpamOpts,
  type TermCategory,
} from "./engine";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let CACHE: { matcher: CompiledMatcher; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadLexicon(): Promise<Lexicon> {
  const [{ data: v }, { data: terms }] = await Promise.all([
    supabaseAdmin.from("moderation_lexicon_version").select("version").eq("id", 1).maybeSingle(),
    supabaseAdmin
      .from("moderation_terms")
      .select("id, term, kind, severity, category, enabled")
      .eq("enabled", true),
  ]);
  const version = Number(v?.version ?? 0);
  return { version, terms: (terms ?? []) as LexiconTerm[] };
}

async function getMatcher(): Promise<CompiledMatcher> {
  const now = Date.now();
  if (CACHE && now - CACHE.loadedAt < CACHE_TTL_MS) return CACHE.matcher;
  // Peek version cheaply; if unchanged & cache present, extend
  if (CACHE) {
    const { data } = await supabaseAdmin
      .from("moderation_lexicon_version")
      .select("version")
      .eq("id", 1)
      .maybeSingle();
    if (data && Number(data.version) === CACHE.matcher.version) {
      CACHE.loadedAt = now;
      return CACHE.matcher;
    }
  }
  const lex = await loadLexicon();
  const matcher = compileMatcher(lex);
  CACHE = { matcher, loadedAt: now };
  return matcher;
}

/** Force cache reload — call from admin term/rule mutations. */
export function invalidateModerationCache() {
  CACHE = null;
}

export class ModerationError extends Error {
  readonly category: TermCategory;
  readonly severity: "block" | "warn" | "flag";
  constructor(message: string, category: TermCategory, severity: "block" | "warn" | "flag") {
    super(message);
    this.name = "ModerationError";
    this.category = category;
    this.severity = severity;
  }
}

function hashTerm(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

async function logEvent(row: {
  userId: string | null;
  surface: string;
  subjectId?: string | null;
  category: TermCategory;
  severity: "block" | "warn" | "flag";
  termHash?: string | null;
}) {
  try {
    await supabaseAdmin.from("moderation_events").insert({
      user_id: row.userId,
      surface: row.surface,
      subject_id: row.subjectId ?? null,
      category: row.category,
      severity: row.severity,
      term_hash: row.termHash ?? null,
    });
  } catch {
    // never fail the request because logging failed
  }
}

export type ModerateInput = {
  userId: string | null;
  surface: string;
  text: string | null | undefined;
  subjectId?: string | null;
  spam?: SpamOpts;
  /** If true, warn-severity matches also throw. Default false. */
  strict?: boolean;
};

/**
 * Runs the shared engine against `text` and throws ModerationError on block.
 * Also enforces a per-user cooldown once repeated blocks accumulate.
 */
export async function moderateOrThrow(input: ModerateInput): Promise<void> {
  const text = (input.text ?? "").toString();
  if (!text.trim()) return; // nothing to moderate

  // Repeat-abuse cooldown: 5+ blocks in the last 10 minutes → 5-min soft ban.
  if (input.userId) {
    const { data: recentBlocks } = await supabaseAdmin.rpc(
      "moderation_recent_block_count",
      { _user: input.userId, _window_s: 600 },
    );
    if (typeof recentBlocks === "number" && recentBlocks >= 5) {
      await logEvent({
        userId: input.userId,
        surface: input.surface,
        subjectId: input.subjectId,
        category: "harassment",
        severity: "flag",
      });
      throw new ModerationError(
        "You're posting too fast. Please wait a few minutes and try again.",
        "harassment",
        "flag",
      );
    }
  }

  const matcher = await getMatcher();
  const result = check(text, matcher);
  if (!result.ok) {
    await logEvent({
      userId: input.userId,
      surface: input.surface,
      subjectId: input.subjectId,
      category: result.category,
      severity: result.severity,
      termHash: hashTerm(result.termHashInput),
    });
    if (result.severity === "block" || input.strict) {
      throw new ModerationError(MODERATION_MESSAGES[result.category], result.category, "block");
    }
    // warn: log-only, allow through
  }

  if (input.spam) {
    const s = checkSpam(text, input.spam);
    if (!s.ok) {
      await logEvent({
        userId: input.userId,
        surface: input.surface,
        subjectId: input.subjectId,
        category: "spam",
        severity: s.severity,
      });
      if (s.severity === "block") {
        throw new ModerationError(MODERATION_MESSAGES.spam, "spam", "block");
      }
    }
  }
}

/** Moderate several fields at once; throws on the first block. */
export async function moderateFields(
  userId: string | null,
  surface: string,
  fields: Record<string, string | null | undefined>,
  spam?: SpamOpts,
): Promise<void> {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    await moderateOrThrow({
      userId,
      surface: `${surface}.${key}`,
      text: value,
      spam,
    });
  }
}
