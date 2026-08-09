import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderTaxonomySql } from "./taxonomy.sql";

/**
 * The taxonomy exists in TypeScript and in Postgres. `src/lib/taxonomy.ts` is
 * the author; the SQL is generated. If someone edits the maps without
 * regenerating (and applying) the SQL, the two drift and rows stop matching
 * the labels the UI shows — so fail loudly here instead.
 */
describe("taxonomy SQL mirror", () => {
  it("matches the checked-in generated file", () => {
    const onDisk = readFileSync("supabase/generated/taxonomy-functions.sql", "utf8");
    expect(renderTaxonomySql()).toBe(onDisk);
  });
});
