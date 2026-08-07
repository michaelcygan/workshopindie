import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RESERVED_USERNAMES, normalizeUsername, validateUsername, profilePath, profileUrl } from "./usernames";

describe("username namespace", () => {
  it("normalizes to the allowed character set", () => {
    expect(normalizeUsername("  Michael Cygan! ")).toBe("michaelcygan");
    expect(normalizeUsername("A-b_C9")).toBe("a-b_c9");
  });

  it("rejects reserved, short and malformed handles", () => {
    expect(validateUsername("gallery").ok).toBe(false);
    expect(validateUsername("a").ok).toBe(false);
    expect(validateUsername("bad name").ok).toBe(false);
    expect(validateUsername("michaelcygan").ok).toBe(true);
  });

  it("builds canonical profile URLs", () => {
    expect(profilePath("michaelcygan")).toBe("/michaelcygan");
    expect(profileUrl("michaelcygan")).toBe("https://workshopindie.com/michaelcygan");
  });

  it("reserves every root-level route segment in the generated route tree", () => {
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    const paths = [...tree.matchAll(/^\s*id: '\/([^'/]+)'$/gm)].map((m) => m[1]);
    const missing = paths.filter(
      (p) => !p.startsWith("$") && !p.startsWith(".") && !RESERVED_USERNAMES.has(p.toLowerCase()),
    );
    expect(missing).toEqual([]);
  });
});
