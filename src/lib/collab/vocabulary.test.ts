import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard rail for the lifecycle vocabulary: the only creative states are
 * "In Progress" and "Published" (plus "Archived" as an owner state).
 * Retired words must not come back into Collab surfaces.
 */
const BANNED = [/\bCasting\b/, /\bForming\b/, /\bMaking\b/, /\bClose\b/, /\bClosed\b/, /\bClosing\b/, /Open Collabs/];

const FILES = [
  "src/routes/collab.$slug.tsx",
  "src/routes/collab.index.tsx",
  "src/routes/me.collabs.tsx",
  "src/components/collab-card.tsx",
  "src/components/collab-peek.tsx",
  "src/components/applicants-panel.tsx",
];

function userFacingStrings(source: string): string[] {
  // Quoted strings and JSX text, minus imports and code identifiers.
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("import") && !line.trim().startsWith("//"))
    .filter((line) => !line.includes("closed_at") && !line.includes("collab-lifecycle"));
}

describe("collab lifecycle vocabulary", () => {
  it("resolves the collab surfaces it checks", () => {
    const routes = readdirSync(join(process.cwd(), "src/routes"));
    expect(routes).toContain("collab.$slug.tsx");
  });

  for (const file of FILES) {
    it(`${file} ships no retired lifecycle words`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const offenders: string[] = [];
      for (const line of userFacingStrings(source)) {
        for (const word of BANNED) {
          if (word.test(line)) offenders.push(line.trim());
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
