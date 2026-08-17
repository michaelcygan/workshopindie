/**
 * LEGACY ENUM COMPATIBILITY ONLY.
 *
 * `Category` values are the ones the `category` Postgres enum physically
 * stores. This module is not a taxonomy: the single user-facing vocabulary is
 * Fields in `src/lib/taxonomy.ts` (`FIELD_OPTIONS`, `FIELD_FILTER_OPTIONS`,
 * `fieldLabel`, `categoryLabel`). Nothing new should classify content here —
 * these exports exist so surfaces still writing the legacy enum (workshops,
 * instant rooms, workshop links) keep working, with labels always resolved
 * through the canonical taxonomy so a concept reads identically everywhere.
 */
import { categoryClassFor, categoryLabel, GATHERING_TYPES } from "@/lib/taxonomy";

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

/** Stored enum values that can be published as a Work (excludes topics). */
export const WORK_CATEGORY_IDS = [
  "film",
  "music",
  "writing",
  "writing_book",
  "build",
  "visual",
] as const;
export type WorkCategory = (typeof WORK_CATEGORY_IDS)[number];

/**
 * Stored enum values plus conversation topics, for the workshop / instant
 * pickers that still write the legacy enum. Labels come from the canonical
 * taxonomy, so "build" renders as "Software & AI".
 */
export const CATEGORIES: { id: Category; label: string }[] = [
  ...(WORK_CATEGORY_IDS.map((id) => ({ id, label: categoryLabel(id) })) as {
    id: Category;
    label: string;
  }[]),
  ...(GATHERING_TYPES.map((t) => ({ id: t.id as Category, label: t.label })) as {
    id: Category;
    label: string;
  }[]),
];

export const SOURCE_LABELS: Record<string, string> = {
  workshop: "Workshop",
  collab_board: "Collab",
  meetup: "Meetup",
  instant: "Instant",
  manual: "Portfolio",
};

export const categoryClass = (c: Category) => categoryClassFor(c);
