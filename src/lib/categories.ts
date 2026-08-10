/**
 * Compatibility layer over the canonical taxonomy (`src/lib/taxonomy.ts`).
 *
 * `Category` values are the ones actually stored in the `category` Postgres
 * enum. Labels and colors are derived from the canonical taxonomy so a concept
 * renders identically everywhere (Work, Collab, Group, Profile).
 */
import {
  CANONICAL_SUBTYPES,
  categoryClassFor,
  categoryLabel,
  TOPICS,
  WORK_CANONICAL_IDS,
} from "@/lib/taxonomy";

export {
  normalizeCategory,
  storageValuesFor,
  categoryLabel,
  categoryClassFor,
  CANONICAL_CATEGORIES,
  WORK_CANONICAL_IDS,
  GROUP_CATEGORY_IDS,
  type CanonicalCategory,
} from "@/lib/taxonomy";

export type Category =
  | "film"
  | "music"
  | "writing"
  | "writing_book"
  | "build"
  | "visual"
  | "other"
  | "critique"
  | "business"
  | "coworking"
  | "office_hours"
  | "roundtable"
  | "pitch"
  | "listen_party"
  | "open_mic"
  | "jam"
  | "standup";

/** Stored category values that can be published as a Work (excludes topics). */
export const WORK_CATEGORY_IDS = [
  "film",
  "music",
  "writing",
  "writing_book",
  "build",
  "visual",
] as const;
export type WorkCategory = (typeof WORK_CATEGORY_IDS)[number];

/** Collabs may start uncategorised — "Other" is a valid stored primary there. */
export const COLLAB_CATEGORY_IDS = [...WORK_CATEGORY_IDS, "other"] as const;
export type CollabCategory = (typeof COLLAB_CATEGORY_IDS)[number];
export const COLLAB_CATEGORIES: { id: CollabCategory; label: string }[] = COLLAB_CATEGORY_IDS.map(
  (id) => ({ id, label: categoryLabel(id) }),
);

/** Canonical work categories, for filter tabs and pickers that want one entry per concept. */
export const CANONICAL_WORK_CATEGORIES = WORK_CANONICAL_IDS.map((id) => ({
  id,
  label: categoryLabel(id),
}));

export const CATEGORIES: { id: Category; label: string }[] = [
  ...(WORK_CATEGORY_IDS.map((id) => ({ id, label: categoryLabel(id) })) as {
    id: Category;
    label: string;
  }[]),
  ...(TOPICS.map((t) => ({ id: t.id as Category, label: t.label })) as {
    id: Category;
    label: string;
  }[]),
];

export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<Category, string>;

export const WORK_CATEGORIES = CATEGORIES.filter((c) =>
  (WORK_CATEGORY_IDS as readonly string[]).includes(c.id),
);

/**
 * @deprecated Formats are now Field-driven — use `formatSuggestionsFor()` from
 * `@/lib/taxonomy`. Kept while the last legacy callers migrate.
 */
export const WORK_SUBTYPES: Record<WorkCategory, string[]> = {
  film: CANONICAL_SUBTYPES.film_video,
  music: CANONICAL_SUBTYPES.music,
  writing: CANONICAL_SUBTYPES.writing,
  writing_book: [
    "Novel",
    "Novella",
    "Short story collection",
    "Poetry",
    "Memoir",
    "Nonfiction",
    "Anthology",
    "Zine",
    "Serial",
  ],
  build: CANONICAL_SUBTYPES.software_ai,
  visual: CANONICAL_SUBTYPES.visual_art,
};


export const SOURCE_LABELS: Record<string, string> = {
  workshop: "Workshop",
  collab_board: "Collab",
  meetup: "Meetup",
  instant: "Instant",
  manual: "Portfolio",
};

export const categoryClass = (c: Category) => categoryClassFor(c);
