/**
 * Subject and Material — normalized free tags on a Work.
 *
 * Subject  = what the Work is about (portable; the Blog pass will reuse this).
 * Material = what a physical Work is made from. Never a file type or MIME type.
 */

export const MAX_SUBJECTS = 8;
export const MAX_MATERIALS = 8;
export const MAX_TAG_LEN = 40;

function normalizeOne(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LEN);
  return v.length > 0 ? v : null;
}

/** Trim, collapse whitespace, dedupe case-insensitively, cap. Order preserved. */
export function normalizeTags(values: readonly (string | null | undefined)[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const v = normalizeOne(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export const normalizeSubjects = (v: readonly (string | null | undefined)[]) =>
  normalizeTags(v, MAX_SUBJECTS);

export const normalizeMaterials = (v: readonly (string | null | undefined)[]) =>
  normalizeTags(v, MAX_MATERIALS);

export const SUBJECT_SUGGESTIONS = [
  "Portrait",
  "Landscape",
  "City",
  "Family",
  "Memory",
  "Nature",
  "Politics",
  "Identity",
  "Music scene",
  "Work & labor",
  "Technology",
  "Faith",
  "Queer life",
  "Migration",
  "Climate",
  "Sport",
  "Food",
  "Nightlife",
  "History",
  "Love",
];

export const MATERIAL_SUGGESTIONS = [
  "Oil paint",
  "Acrylic",
  "Watercolor",
  "Canvas",
  "Paper",
  "Wood",
  "Terracotta",
  "Stoneware",
  "Porcelain",
  "Bronze",
  "Steel",
  "Glass",
  "Textile",
  "Concrete",
  "Plaster",
  "Ink",
  "Charcoal",
  "Found objects",
  "Resin",
  "Clay",
];
