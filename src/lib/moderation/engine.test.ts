/**
 * Deterministic tests for the shared moderation engine.
 *
 * These run in CI on every push. Moderation is the one subsystem that must
 * never regress silently: a lexicon or matcher change that stops catching an
 * evasion is invisible in the product until someone is harmed by it.
 *
 * The evasion cases (spacing, punctuation, leetspeak, zero-width joiners,
 * Cyrillic confusables) are the real-world forms these terms arrive in. The
 * false-positive cases are equally load-bearing: over-blocking ordinary words
 * silences people, so "Scunthorpe", "assassin" and "pass" must stay allowed.
 */

import { describe, expect, it } from "vitest";

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

const blocks = (text: string) => check(text, matcher).ok === false;
const allows = (text: string) => check(text, matcher).ok === true;

describe("moderation engine — blocking", () => {
  it("blocks a direct slur", () => {
    expect(blocks("you are a nigger")).toBe(true);
  });

  it.each([
    ["spacing and case", "N I G G E R!"],
    ["punctuation separators", "n.i.g.g.e.r"],
    ["leetspeak", "n1gg3r"],
    ["zero-width injection", "nig\u200Bger"],
    ["Cyrillic confusable", "nіgger"],
  ])("defeats evasion by %s", (_label, text) => {
    expect(blocks(text)).toBe(true);
  });

  it("matches a phrase across a newline", () => {
    expect(blocks("i will\nkill you")).toBe(true);
  });

  it("flags warn-severity terms without blocking them", () => {
    const result = check("kms", matcher);
    expect(result.ok).toBe(false);
    expect(result.severity).toBe("warn");
  });
});

describe("moderation engine — false positives", () => {
  it.each([
    ["allowlisted place name", "Scunthorpe is a town"],
    ["no substring matches", "classic assassin analysis"],
    ["ass-substrings", "bass and passing pass class"],
    ["emails and URLs", "hello@example.com"],
    ["ordinary profanity, which is not in the lexicon", "what the fuck this is shit"],
    ["Japanese", "こんにちは世界"],
    ["Arabic", "مرحبا بالعالم"],
    ["Cyrillic prose", "Привет мир"],
  ])("allows %s", (_label, text) => {
    expect(allows(text)).toBe(true);
  });
});

describe("moderation engine — spam heuristics", () => {
  it("flags long character repetition", () => {
    expect(checkSpam("a".repeat(200), { maxRepeatChars: 30 }).ok).toBe(false);
  });

  it("flags link floods", () => {
    const text =
      "http://a.com http://b.com http://c.com http://d.com http://e.com http://f.com";
    expect(checkSpam(text, { maxLinks: 4 }).ok).toBe(false);
  });

  it("allows a single link", () => {
    expect(checkSpam("hi https://portfolio.example.com", { maxLinks: 4 }).ok).toBe(true);
  });
});

describe("normalize", () => {
  it("collapses surrounding whitespace without altering inner words", () => {
    expect(normalize("  hello world  ").normalized).toBe("hello world");
  });
});
