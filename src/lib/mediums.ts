import { WORK_CATEGORY_IDS, type WorkCategory } from "@/lib/categories";

/**
 * Mediums shown in the profile flow.
 * - `WORK_MEDIUMS` mirror the 5 publishable Category ids — toggling them in the
 *   profile picker writes to `profiles.categories` (drives Works tabs, gallery
 *   filters, Instant Workshops).
 * - `EXTRA_MEDIUMS` are profile-only descriptors stored in `profiles.mediums`.
 *
 * Critique / Business of Art / Co-working are intentionally absent — they
 * remain in `categories.ts` for workshop / instant contexts only.
 */

export const WORK_MEDIUMS: { id: WorkCategory; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "writing", label: "Writing" },
  { id: "build", label: "Build" },
  { id: "visual", label: "Visual" },
];

export const EXTRA_MEDIUM_IDS = [
  "photography",
  "photography-analog",
  "printmaking",
  "textiles",
  "ceramics",
  "sculpture",
  "painting",
  "illustration",
  "design",
  "fashion",
  "jewelry",
  "animation",
  "comics",
  "poetry",
  "journalism",
  "songwriting",
  "production",
  "dj",
  "performance",
  "dance",
  "theater",
  "sound-design",
  "podcasting",
  "game-design",
  "code",
] as const;

export type ExtraMedium = (typeof EXTRA_MEDIUM_IDS)[number];

const EXTRA_LABELS: Record<ExtraMedium, string> = {
  photography: "Photography",
  "photography-analog": "Analog photo",
  printmaking: "Printmaking",
  textiles: "Textiles",
  ceramics: "Ceramics",
  sculpture: "Sculpture",
  painting: "Painting",
  illustration: "Illustration",
  design: "Design",
  fashion: "Fashion",
  jewelry: "Jewelry",
  animation: "Animation",
  comics: "Comics",
  poetry: "Poetry",
  journalism: "Journalism",
  songwriting: "Songwriting",
  production: "Production",
  dj: "DJ",
  performance: "Performance",
  dance: "Dance",
  theater: "Theater",
  "sound-design": "Sound design",
  podcasting: "Podcasting",
  "game-design": "Game design",
  code: "Code",
};

export const EXTRA_MEDIUMS: { id: ExtraMedium; label: string }[] =
  EXTRA_MEDIUM_IDS.map((id) => ({ id, label: EXTRA_LABELS[id] }));

export function isExtraMedium(id: string): id is ExtraMedium {
  return (EXTRA_MEDIUM_IDS as readonly string[]).includes(id);
}

export function isWorkMedium(id: string): id is WorkCategory {
  return (WORK_CATEGORY_IDS as readonly string[]).includes(id);
}

export function extraMediumLabel(id: string): string {
  return isExtraMedium(id) ? EXTRA_LABELS[id] : id;
}

export const MAX_TOOLS = 15;
export const MAX_TOOL_LEN = 40;
