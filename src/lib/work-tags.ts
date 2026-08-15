/**
 * Subject and Material — normalized free tags on a Work.
 *
 * Subject  = what the Work is about (portable; Blog reuses the same behavior
 *            through the entity-neutral `@/lib/entity-tags` module).
 * Material = what a physical Work is made from. Never a file type or MIME type.
 */
import { MAX_TAG_LEN, normalizeTags } from "@/lib/entity-tags";

export const MAX_SUBJECTS = 8;
export const MAX_MATERIALS = 8;
export { MAX_TAG_LEN, normalizeTags };


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
