import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Wave 1 guard: `workshopEntityUrl` is the only place that knows what a
 * Workshop entity path looks like. Every other module must ask for the URL
 * rather than templating one, otherwise a future route change silently leaves
 * dead links behind on whichever surface got missed.
 */

const ROOT = "src";
const ALLOWED = new Set([join("src", "lib", "entities", "kinds.ts")]);

/** Interpolated entity paths: `/works/${x}`, `/g/${x}/e/${y}`, etc. */
const HANDBUILT = /`[^`]*?\/(?:works|collab|blog|g)\/\$\{/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "integrations") continue;
      walk(p, out);
      continue;
    }
    if (!/\.tsx?$/.test(p) || /\.test\./.test(p)) continue;
    out.push(p);
  }
  return out;
}

describe("entity URL resolver", () => {
  it("is the only module that templates Workshop entity paths", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (ALLOWED.has(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const [i, line] of src.split("\n").entries()) {
        // A query-suffixed join link is a different thing than an entity URL.
        if (line.includes("?j=")) continue;
        if (HANDBUILT.test(line)) offenders.push(`${file}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
