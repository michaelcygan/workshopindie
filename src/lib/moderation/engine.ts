// Isomorphic moderation engine — pure functions, no I/O.
// Safe to import from both server functions and client bundles.

export type TermKind = "exact" | "phrase" | "regex" | "allow";
export type TermSeverity = "block" | "warn" | "flag";
export type TermCategory = "slur" | "threat" | "harassment" | "spam";

export type LexiconTerm = {
  id?: string;
  term: string;
  kind: TermKind;
  severity: TermSeverity;
  category: TermCategory;
  enabled?: boolean;
};

export type Lexicon = { version: number; terms: LexiconTerm[] };

// Confusables — small, hand-curated. Covers common Cyrillic/Greek/fullwidth swaps.
const CONFUSABLES: Record<string, string> = {
  "а": "a", "А": "a", "ɑ": "a", "α": "a", "@": "a",
  "б": "b", "Ь": "b", "β": "b",
  "с": "c", "С": "c", "ϲ": "c",
  "е": "e", "Е": "e", "ε": "e", "€": "e",
  "һ": "h", "н": "h",
  "і": "i", "І": "i", "ι": "i", "ï": "i", "!": "i", "1": "i", "|": "i", "l": "i", "L": "i",
  "ј": "j", "Ј": "j",
  "к": "k", "К": "k",
  "м": "m", "М": "m",
  "п": "n", "и": "n",
  "о": "o", "О": "o", "ο": "o", "Ο": "o", "0": "o", "()": "o",
  "р": "p", "Р": "p", "ρ": "p",
  "ԛ": "q",
  "г": "r", "я": "r",
  "ѕ": "s", "Ѕ": "s", "$": "s", "5": "s", "§": "s",
  "т": "t", "Т": "t", "7": "t", "+": "t",
  "υ": "u", "ц": "u",
  "ν": "v", "ѵ": "v",
  "ѡ": "w", "ω": "w",
  "х": "x", "Х": "x", "×": "x",
  "у": "y", "У": "y",
  "з": "z", "2": "z",
  "3": "e", "4": "a", "6": "g", "8": "b", "9": "g",
};

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u2060\u180E]/g;
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Normalize for match-only use. NEVER modifies the user's original text.
 * Returns two haystacks:
 *   - `spaced`: whitespace preserved between distinct words, in-word punctuation
 *     stripped, repeats collapsed. Used for phrase matching + allowlist.
 *   - `tight`: additionally strips all whitespace. Used for single-term matching
 *     so "n i g g e r" and "n.i.g.g.e.r" both collapse to "nigger".
 */
export function normalize(input: string): { normalized: string; tight: string } {
  if (!input) return { normalized: "", tight: "" };
  let s = input.normalize("NFKD");
  s = s.replace(ZERO_WIDTH, "");
  s = s.replace(DIACRITICS, "");
  let out = "";
  for (const ch of s) out += CONFUSABLES[ch] ?? ch;
  s = out.toLowerCase();
  const spaced = s
    // strip in-word punctuation only (not whitespace)
    .replace(/([a-z0-9])[._\-*+~'"`^]+(?=[a-z0-9])/g, "$1")
    .replace(/([a-z0-9])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
  const tight = spaced.replace(/\s+/g, "");
  return { normalized: spaced, tight };
}


export type CompiledMatcher = {
  version: number;
  block: CompiledRule[];
  warn: CompiledRule[];
  allow: CompiledRule[];
};
type CompiledRule = {
  id?: string;
  category: TermCategory;
  regex: RegExp;
  target: "spaced" | "tight";
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileOne(t: LexiconTerm): CompiledRule | null {
  const normTerm = normalize(t.term).normalized;
  if (!normTerm || normTerm.length < 2) return null;
  try {
    if (t.kind === "regex") {
      return { id: t.id, category: t.category, regex: new RegExp(t.term, "iu"), target: "spaced" };
    }
    if (t.kind === "phrase" || t.kind === "allow") {
      const parts = normTerm.split(/\s+/).map(escapeRegex);
      const pat = `(?:^|\\P{L})${parts.join("\\s+")}(?:$|\\P{L})`;
      return { id: t.id, category: t.category, regex: new RegExp(pat, "iu"), target: "spaced" };
    }
    // exact: short terms (≤4 chars) require word boundaries against `spaced`
    // to avoid substring collisions (e.g. "kys" in "keystone"). Longer, more
    // distinctive terms run as substring against `tight` so obfuscations like
    // "n i g g e r" and "n.i.g.g.e.r" both match.
    if (normTerm.length <= 4) {
      const pat = `(?:^|\\P{L})${escapeRegex(normTerm)}(?:$|\\P{L})`;
      return { id: t.id, category: t.category, regex: new RegExp(pat, "iu"), target: "spaced" };
    }
    return {
      id: t.id,
      category: t.category,
      regex: new RegExp(escapeRegex(normTerm), "iu"),
      target: "tight",
    };
  } catch {
    return null;
  }
}

export function compileMatcher(lex: Lexicon): CompiledMatcher {
  const block: CompiledRule[] = [];
  const warn: CompiledRule[] = [];
  const allow: CompiledRule[] = [];
  for (const t of lex.terms) {
    if (t.enabled === false) continue;
    const r = compileOne(t);
    if (!r) continue;
    if (t.kind === "allow") allow.push(r);
    else if (t.severity === "block") block.push(r);
    else warn.push(r);
  }
  return { version: lex.version, block, warn, allow };
}

export type CheckResult =
  | { ok: true }
  | { ok: false; severity: "block" | "warn"; category: TermCategory; ruleId?: string; termHashInput: string };

function testRule(r: CompiledRule, spaced: string, tight: string): boolean {
  return r.target === "tight" ? r.regex.test(tight) : r.regex.test(spaced);
}

export function check(text: string, m: CompiledMatcher): CheckResult {
  if (!text) return { ok: true };
  const { normalized: spaced, tight } = normalize(text);
  if (!spaced) return { ok: true };

  const allowed = m.allow.some((r) => testRule(r, spaced, tight));

  for (const r of m.block) {
    if (testRule(r, spaced, tight)) {
      if (allowed) continue;
      return { ok: false, severity: "block", category: r.category, ruleId: r.id, termHashInput: r.regex.source };
    }
  }
  for (const r of m.warn) {
    if (testRule(r, spaced, tight)) {
      if (allowed) continue;
      return { ok: false, severity: "warn", category: r.category, ruleId: r.id, termHashInput: r.regex.source };
    }
  }
  return { ok: true };
}


// Spam heuristics — deterministic, per-surface thresholds passed in.
export type SpamOpts = {
  maxLinks?: number;
  maxMentions?: number;
  maxRepeatChars?: number; // longest run of a single char
  minLength?: number;
};

export type SpamResult =
  | { ok: true }
  | { ok: false; severity: "warn" | "block"; category: "spam"; reason: string };

const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
const MENTION_RE = /(^|\s)@[a-zA-Z0-9_]{2,}/g;

export function checkSpam(text: string, opts: SpamOpts = {}): SpamResult {
  if (!text) return { ok: true };
  const t = text.trim();
  const links = (t.match(URL_RE) ?? []).length;
  const mentions = (t.match(MENTION_RE) ?? []).length;
  const longestRun = Math.max(0, ...Array.from(t.matchAll(/(.)\1{4,}/g)).map((m) => m[0].length));

  if (opts.maxLinks != null && links > opts.maxLinks) {
    return { ok: false, severity: links > opts.maxLinks * 2 ? "block" : "warn", category: "spam", reason: "links" };
  }
  if (opts.maxMentions != null && mentions > opts.maxMentions) {
    return { ok: false, severity: "warn", category: "spam", reason: "mentions" };
  }
  if (opts.maxRepeatChars != null && longestRun > opts.maxRepeatChars) {
    return { ok: false, severity: "warn", category: "spam", reason: "repetition" };
  }
  return { ok: true };
}

// User-facing generic messages. NEVER include the matched term.
export const MODERATION_MESSAGES: Record<TermCategory, string> = {
  slur:
    "This can't be posted because it contains language prohibited by Workshop's community standards. Please revise it and try again.",
  threat:
    "This can't be posted because it contains threatening language. Please revise it and try again.",
  harassment:
    "This can't be posted because it appears to target another person. Please revise it and try again.",
  spam:
    "This looks like spam. Please reduce links, mentions, or repeated text and try again.",
};
