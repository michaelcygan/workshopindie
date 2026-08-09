/**
 * Generates the database mirror of the canonical taxonomy.
 *
 * Workshop keeps the same mapping in two places by necessity: TypeScript needs
 * it for labels, chips and filters; Postgres needs it for the trigger-synced
 * `*_canonical` columns and the medium-group fan-out. Before this module the
 * two were maintained by hand and had already drifted — `design` existed in
 * TypeScript and not in SQL.
 *
 * `src/lib/taxonomy.ts` is now the only author. This module renders the three
 * `IMMUTABLE` mapping functions from those maps; the rendered text is checked
 * in at `supabase/generated/taxonomy-functions.sql` and asserted by a test, so
 * a TypeScript-only change fails CI until the SQL is regenerated and applied.
 */

import {
  MEDIUM_TO_CANONICAL,
  STORAGE_TO_CANONICAL,
  type CanonicalCategory,
} from "@/lib/taxonomy";

/**
 * Canonicals a Work / Collab / Profile can be fanned out to a medium Group
 * under. Community flavors (city, scene life, language) and `other` are
 * deliberately excluded: they are not creative mediums.
 */
export const MEDIUM_CANONICALS: readonly CanonicalCategory[] = [
  "music",
  "film_video",
  "writing",
  "visual_art",
  "games_tech",
  "performance",
  "audio",
  "design",
];

function whenClauses(pairs: Array<[string, string]>): string {
  return pairs.map(([from, to]) => `    WHEN '${from}' THEN '${to}'`).join("\n");
}

function sqlFn(name: string, arg: string, pairs: Array<[string, string]>): string {
  return [
    `CREATE OR REPLACE FUNCTION public.${name}(${arg} text)`,
    `RETURNS text`,
    `LANGUAGE sql`,
    `IMMUTABLE`,
    `SET search_path TO 'public'`,
    `AS $function$`,
    `  SELECT CASE ${arg}`,
    whenClauses(pairs),
    `    ELSE NULL`,
    `  END;`,
    `$function$;`,
  ].join("\n");
}

/** The full SQL text mirroring the TypeScript taxonomy. Deterministic. */
export function renderTaxonomySql(): string {
  const storage = Object.entries(STORAGE_TO_CANONICAL).sort(([a], [b]) => a.localeCompare(b));

  const mediumSet = new Set<string>(MEDIUM_CANONICALS);
  const fromStorage = storage.filter(([, canon]) => mediumSet.has(canon));

  // medium_to_canonical accepts the fine-grained mediums plus everything
  // canonical_from_storage accepts, so a profile medium and a work category
  // resolve through one call.
  const mediums = [...Object.entries(MEDIUM_TO_CANONICAL), ...fromStorage]
    .filter((pair, i, all) => all.findIndex(([k]) => k === pair[0]) === i)
    .sort(([a], [b]) => a.localeCompare(b));

  return [
    "-- GENERATED FILE — do not edit by hand.",
    "-- Source of truth: src/lib/taxonomy.ts (rendered by src/lib/taxonomy.sql.ts).",
    "-- Regenerate, then apply as a migration, whenever the taxonomy changes.",
    "",
    sqlFn("canonical_category", "_value", storage),
    "",
    sqlFn("canonical_from_storage", "_value", fromStorage),
    "",
    sqlFn("medium_to_canonical", "_medium", mediums),
    "",
  ].join("\n");
}
