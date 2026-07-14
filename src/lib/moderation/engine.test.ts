/**
 * Deterministic tests for the shared moderation engine.
 * Runnable with `bun test src/lib/moderation/engine.test.ts`.
 * Framework-agnostic assertions so this file also works with vitest/jest.
 */

import { check, checkSpam, compileMatcher, normalize, type Lexicon } from "./engine";

const lex: Lexicon = {
  version: 1,
  terms: [
    { term: "nigger", kind: "exact", severity: "block", category: "slur" },
    { term: "kys", kind: "exact", severity: "block", category: "threat" },
    { term: "i will kill you", kind: "phrase", severity: "block", category: "threat" },
    { term: "kms", kind: "exact", severity: "warn", category: "threat" },
    { term: "scunthorpe", kind: "allow", severity: "block", category: "slur" },
  ],
};

const matcher = compileMatcher(lex);

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("assert failed: " + msg);
}

// direct slur
assert(check("you are a nigger", matcher).ok === false, "direct slur should block");

// case + punctuation
assert(check("N I G G E R!", matcher).ok === false, "spaced slur blocks");
assert(check("n.i.g.g.e.r", matcher).ok === false, "punctuation-separated blocks");
assert(check("n1gg3r", matcher).ok === false, "leetspeak blocks");

// zero-width injection
assert(check("nig\u200Bger", matcher).ok === false, "zero-width injection blocks");

// confusable
assert(check("nіgger", matcher).ok === false, "cyrillic confusable blocks");

// phrase, across newline
assert(check("i will\nkill you", matcher).ok === false, "phrase across newline blocks");

// warn severity does not block
const kmsRes = check("kms", matcher);
assert(kmsRes.ok === false && kmsRes.severity === "warn", "kms warns but does not block");

// false positives
assert(check("Scunthorpe is a town", matcher).ok === true, "allowlisted town OK");
assert(check("classic assassin analysis", matcher).ok === true, "no substring false positives");
assert(check("bass and passing pass class", matcher).ok === true, "ass-substrings OK");
assert(check("hello@example.com", matcher).ok === true, "URL/email OK");

// ordinary profanity — not in lexicon => allowed
assert(check("what the fuck this is shit", matcher).ok === true, "ordinary profanity allowed");

// non-english valid text
assert(check("こんにちは世界", matcher).ok === true, "japanese OK");
assert(check("مرحبا بالعالم", matcher).ok === true, "arabic OK");
assert(check("Привет мир", matcher).ok === true, "cyrillic OK");

// spam heuristics
assert(checkSpam("a".repeat(200), { maxRepeatChars: 30 }).ok === false, "repetition flagged");
assert(
  checkSpam(
    "http://a.com http://b.com http://c.com http://d.com http://e.com http://f.com",
    { maxLinks: 4 },
  ).ok === false,
  "too many links flagged",
);
assert(checkSpam("hi https://portfolio.example.com", { maxLinks: 4 }).ok === true, "one link OK");

// normalize does not mutate whitespace inside phrases
assert(normalize("  hello world  ").normalized === "hello world", "normalize collapses whitespace");

console.log("moderation/engine tests passed");
