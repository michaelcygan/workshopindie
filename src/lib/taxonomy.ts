/**
 * Workshop canonical creative taxonomy.
 *
 * This is the single source of truth for creative categories across Works,
 * Collabs, Groups, Events and Profiles. The database still stores two legacy
 * enums (`category` for works/collabs/profiles, `group_category` for groups);
 * this module normalizes both to one canonical set at the display/filter
 * boundary so labels never drift again. No storage values are rewritten.
 */

export type CanonicalCategory =
  | "music"
  | "film_video"
  | "writing"
  | "visual_art"
  | "games_tech"
  | "performance"
  | "audio"
  | "design"
  | "scene_life"
  | "city"
  | "language"
  | "other";

export type CategoryEntry = {
  id: CanonicalCategory;
  label: string;
  /** Tailwind token pair for chips/pills. */
  className: string;
  /** Community-flavor categories: valid for Groups, not for Works/Collabs. */
  community?: boolean;
};

export const CANONICAL_CATEGORIES: CategoryEntry[] = [
  { id: "music", label: "Music", className: "bg-cat-music text-cat-music-ink" },
  { id: "film_video", label: "Film & Video", className: "bg-cat-film text-cat-film-ink" },
  { id: "writing", label: "Writing", className: "bg-cat-writing text-cat-writing-ink" },
  { id: "visual_art", label: "Visual Art", className: "bg-cat-visual text-cat-visual-ink" },
  { id: "games_tech", label: "Games & Tech", className: "bg-cat-build text-cat-build-ink" },
  { id: "performance", label: "Performance", className: "bg-cat-standup text-cat-standup-ink" },
  { id: "audio", label: "Audio", className: "bg-cat-listen-party text-cat-listen-party-ink" },
  { id: "design", label: "Design", className: "bg-cat-coworking text-cat-coworking-ink" },
  { id: "scene_life", label: "Scene & Lifestyle", className: "bg-cat-jam text-cat-jam-ink", community: true },
  { id: "city", label: "Cities", className: "bg-cat-roundtable text-cat-roundtable-ink", community: true },
  { id: "language", label: "Languages", className: "bg-cat-office-hours text-cat-office-hours-ink", community: true },
  { id: "other", label: "Other", className: "bg-muted text-ink-soft" },
];

const BY_ID = new Map(CANONICAL_CATEGORIES.map((c) => [c.id, c]));

/** Canonical categories a Work or Collab can be published under. */
export const WORK_CANONICAL_IDS = [
  "music",
  "film_video",
  "writing",
  "visual_art",
  "games_tech",
] as const satisfies readonly CanonicalCategory[];

/** Every value the `group_category` enum can hold, in display order. */
export const GROUP_CATEGORY_IDS = [
  "music",
  "film_video",
  "writing",
  "visual_art",
  "games_tech",
  "performance",
  "audio",
  "scene_life",
  "city",
  "language",
] as const;

/** Legacy stored value -> canonical id. Canonical ids map to themselves. */
const LEGACY_TO_CANONICAL: Record<string, CanonicalCategory> = {
  film: "film_video",
  film_video: "film_video",
  visual: "visual_art",
  visual_art: "visual_art",
  build: "games_tech",
  games_tech: "games_tech",
  writing: "writing",
  writing_book: "writing",
  music: "music",
  performance: "performance",
  audio: "audio",
  design: "design",
  scene_life: "scene_life",
  city: "city",
  language: "language",
  other: "other",
};

/**
 * Canonical id -> the stored enum values a Works/Collabs/Profiles query must
 * filter on. This is what keeps existing rows discoverable under new labels.
 */
const CANONICAL_TO_STORAGE: Partial<Record<CanonicalCategory, string[]>> = {
  music: ["music"],
  film_video: ["film", "film_video"],
  writing: ["writing", "writing_book"],
  visual_art: ["visual", "visual_art"],
  games_tech: ["build", "games_tech"],
  performance: ["performance"],
  audio: ["audio"],
  design: ["design"],
  scene_life: ["scene_life"],
  city: ["city"],
  language: ["language"],
  other: ["other"],
};

/**
 * Display overrides for stored values that are more specific than their
 * canonical bucket. `writing_book` stays "Book" so nothing reads as less
 * specific than it does today, while still living under Writing for filters.
 */
const STORAGE_LABEL_OVERRIDES: Record<string, string> = {
  writing_book: "Book",
};

const STORAGE_CLASS_OVERRIDES: Record<string, string> = {
  writing_book: "bg-cat-book text-cat-book-ink",
};

/** Conversation / gathering topics. Not creative categories. */
export const TOPICS: { id: string; label: string; className: string }[] = [
  { id: "critique", label: "Critique", className: "bg-cat-critique text-cat-critique-ink" },
  { id: "business", label: "Business of Art", className: "bg-cat-business text-cat-business-ink" },
  { id: "coworking", label: "Co-working", className: "bg-cat-coworking text-cat-coworking-ink" },
  { id: "office_hours", label: "Office Hours", className: "bg-cat-office-hours text-cat-office-hours-ink" },
  { id: "roundtable", label: "Roundtable", className: "bg-cat-roundtable text-cat-roundtable-ink" },
  { id: "pitch", label: "Pitch", className: "bg-cat-pitch text-cat-pitch-ink" },
  { id: "listen_party", label: "Listen Party", className: "bg-cat-listen-party text-cat-listen-party-ink" },
  { id: "open_mic", label: "Open Mic", className: "bg-cat-open-mic text-cat-open-mic-ink" },
  { id: "jam", label: "Jam", className: "bg-cat-jam text-cat-jam-ink" },
  { id: "standup", label: "Stand-up", className: "bg-cat-standup text-cat-standup-ink" },
];

const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export const isTopic = (value: string | null | undefined): boolean =>
  !!value && TOPIC_BY_ID.has(value);

/** Legacy or canonical value in, canonical id out. */
export function normalizeCategory(value: string | null | undefined): CanonicalCategory {
  if (!value) return "other";
  return LEGACY_TO_CANONICAL[value] ?? "other";
}

/** Safe label for any stored or canonical value, including topics. */
export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  if (STORAGE_LABEL_OVERRIDES[value]) return STORAGE_LABEL_OVERRIDES[value];
  const topic = TOPIC_BY_ID.get(value);
  if (topic) return topic.label;
  return BY_ID.get(normalizeCategory(value))?.label ?? "Other";
}

/** Safe chip classes for any stored or canonical value, including topics. */
export function categoryClassFor(value: string | null | undefined): string {
  if (!value) return "bg-muted text-ink-soft";
  if (STORAGE_CLASS_OVERRIDES[value]) return STORAGE_CLASS_OVERRIDES[value];
  const topic = TOPIC_BY_ID.get(value);
  if (topic) return topic.className;
  return BY_ID.get(normalizeCategory(value))?.className ?? "bg-muted text-ink-soft";
}

/**
 * Canonical id -> stored enum values for `.in()` / `.overlaps()` filters.
 * Unknown ids fall back to the id itself so callers can pass raw values.
 */
export function storageValuesFor(canonical: string): string[] {
  return CANONICAL_TO_STORAGE[canonical as CanonicalCategory] ?? [canonical];
}

/** Values the legacy `category` Postgres enum (works / collabs / profiles) accepts. */
export const CATEGORY_ENUM_VALUES = new Set<string>([
  "film",
  "music",
  "writing",
  "writing_book",
  "build",
  "visual",
  "other",
  ...TOPICS.map((t) => t.id),
]);

/**
 * Like `storageValuesFor`, but restricted to values the `category` enum can
 * hold — passing a canonical-only id (e.g. "film_video") to PostgREST against
 * that enum is a 400.
 */
export function workStorageValuesFor(canonical: string): string[] {
  const vals = storageValuesFor(canonical).filter((v) => CATEGORY_ENUM_VALUES.has(v));
  return vals.length > 0 ? vals : [];
}

/** Subtypes shown per canonical category (stored free-form on works.subtype). */
export const CANONICAL_SUBTYPES: Record<string, string[]> = {
  film_video: ["Short film", "Music video", "Trailer", "Documentary", "Animation", "Reel"],
  music: ["Single", "EP / Album", "Live set", "Remix", "Beat", "Demo", "Score"],
  writing: [
    "Essay",
    "Poem",
    "Short story",
    "Screenplay",
    "Newsletter",
    "Article",
    "Novel",
    "Novella",
    "Memoir",
    "Nonfiction",
    "Zine",
  ],
  games_tech: ["App", "Site", "Tool", "Plugin", "Hardware", "Game"],
  visual_art: ["Photo", "Illustration", "Design", "Painting", "Collage", "3D"],
  performance: ["Set", "Reading", "Showcase", "Improv"],
  audio: ["Podcast", "Sound design", "Mix", "Field recording"],
  design: ["Identity", "Type", "Poster", "Product", "Motion"],
};
