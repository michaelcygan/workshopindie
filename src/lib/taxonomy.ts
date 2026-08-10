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
  | "design"
  | "performance"
  | "journalism_media"
  | "software_ai"
  | "making_engineering"
  | "science_research"
  | "architecture_cities"
  | "environment_nature"
  /** Legacy canonical ids. Never emitted by normalization; still accepted on read. */
  | "games_tech"
  | "audio"
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
  /** Legacy id kept for old rows; not offered as a Field in any picker. */
  legacy?: boolean;
};

export const CANONICAL_CATEGORIES: CategoryEntry[] = [
  { id: "music", label: "Music", className: "bg-cat-music text-cat-music-ink" },
  { id: "film_video", label: "Film & Video", className: "bg-cat-film text-cat-film-ink" },
  { id: "writing", label: "Writing", className: "bg-cat-writing text-cat-writing-ink" },
  { id: "visual_art", label: "Visual Art", className: "bg-cat-visual text-cat-visual-ink" },
  { id: "design", label: "Design", className: "bg-cat-coworking text-cat-coworking-ink" },
  { id: "performance", label: "Performance", className: "bg-cat-standup text-cat-standup-ink" },
  {
    id: "journalism_media",
    label: "Journalism & Media",
    className: "bg-cat-listen-party text-cat-listen-party-ink",
  },
  { id: "software_ai", label: "Software & AI", className: "bg-cat-build text-cat-build-ink" },
  {
    id: "making_engineering",
    label: "Making & Engineering",
    className: "bg-cat-pitch text-cat-pitch-ink",
  },
  {
    id: "science_research",
    label: "Science & Research",
    className: "bg-cat-critique text-cat-critique-ink",
  },
  {
    id: "architecture_cities",
    label: "Architecture & Cities",
    className: "bg-cat-roundtable text-cat-roundtable-ink",
  },
  {
    id: "environment_nature",
    label: "Environment & Nature",
    className: "bg-cat-jam text-cat-jam-ink",
  },
  {
    id: "games_tech",
    label: "Software & AI",
    className: "bg-cat-build text-cat-build-ink",
    legacy: true,
  },
  {
    id: "audio",
    label: "Audio",
    className: "bg-cat-listen-party text-cat-listen-party-ink",
    legacy: true,
  },
  {
    id: "scene_life",
    label: "Scene & Lifestyle",
    className: "bg-cat-jam text-cat-jam-ink",
    community: true,
  },
  {
    id: "city",
    label: "Cities",
    className: "bg-cat-roundtable text-cat-roundtable-ink",
    community: true,
  },
  {
    id: "language",
    label: "Languages",
    className: "bg-cat-office-hours text-cat-office-hours-ink",
    community: true,
  },
  { id: "other", label: "Other", className: "bg-muted text-ink-soft" },
];


const BY_ID = new Map(CANONICAL_CATEGORIES.map((c) => [c.id, c]));

/**
 * FIELDS — the shared, user-facing disciplinary vocabulary.
 *
 * Every primitive (Person, Work, Collab, Post, Group, Event) classifies its
 * subject area with these ids and only these ids. Specificity lives in
 * Formats, Groups and profile practices — never in more top-level Fields.
 */
export const FIELD_IDS = [
  "music",
  "film_video",
  "writing",
  "visual_art",
  "design",
  "performance",
  "journalism_media",
  "software_ai",
  "making_engineering",
  "science_research",
  "architecture_cities",
  "environment_nature",
  "other",
] as const satisfies readonly CanonicalCategory[];

export type FieldId = (typeof FIELD_IDS)[number];

const FIELD_ID_SET = new Set<string>(FIELD_IDS);

export type FieldOption = { id: FieldId; label: string; className: string };

/** Ordered options for every Field picker in the product. */
export const FIELD_OPTIONS: readonly FieldOption[] = FIELD_IDS.map((id) => {
  const entry = BY_ID.get(id)!;
  return { id, label: entry.label, className: entry.className };
});

export const isFieldId = (value: unknown): value is FieldId =>
  typeof value === "string" && FIELD_ID_SET.has(value);

/**
 * Field options for discovery filters (Gallery, Collabs, directories).
 * "Other" is deliberately excluded — it is a fallback, not a thing to browse.
 */
export const FIELD_FILTER_OPTIONS: readonly FieldOption[] = FIELD_OPTIONS.filter(
  (o) => o.id !== "other",
);

/** Canonical categories a Work or Collab can be published under. */
export const WORK_CANONICAL_IDS = FIELD_IDS.filter(
  (id) => id !== "other",
) as readonly FieldId[] as readonly CanonicalCategory[];


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

/**
 * Legacy stored value -> canonical id. Canonical ids map to themselves.
 *
 * This map is the single author of the taxonomy. The database mirrors of it
 * (`canonical_category`, `canonical_from_storage`) are *generated* from here
 * into `supabase/generated/taxonomy-functions.sql`; never hand-edit that file
 * or the deployed functions, or the two halves drift apart again.
 */
export const STORAGE_TO_CANONICAL: Record<string, CanonicalCategory> = {
  // Legacy enum values -> modern Fields (compatibility mappings).
  film: "film_video",
  visual: "visual_art",
  build: "software_ai",
  games_tech: "software_ai",
  writing_book: "writing",
  audio: "audio",
  // Field ids map to themselves.
  film_video: "film_video",
  visual_art: "visual_art",
  writing: "writing",
  music: "music",
  performance: "performance",
  design: "design",
  journalism_media: "journalism_media",
  software_ai: "software_ai",
  making_engineering: "making_engineering",
  science_research: "science_research",
  architecture_cities: "architecture_cities",
  environment_nature: "environment_nature",
  // Community group flavors.
  scene_life: "scene_life",
  city: "city",
  language: "language",
  other: "other",
};

const LEGACY_TO_CANONICAL = STORAGE_TO_CANONICAL;

/**
 * Finer-grained mediums a Profile can claim ("practices"). These are more
 * specific than a Field ("photography" is Visual Art), and they are what the
 * medium-group triggers key off, so search, filters and chips must know the
 * same list the database does.
 */
export const MEDIUM_TO_CANONICAL: Record<string, CanonicalCategory> = {
  photography: "visual_art",
  "photography-analog": "visual_art",
  printmaking: "visual_art",
  ceramics: "visual_art",
  sculpture: "visual_art",
  painting: "visual_art",
  illustration: "visual_art",
  comics: "visual_art",
  dj: "music",
  songwriting: "music",
  production: "music",
  poetry: "writing",
  journalism: "journalism_media",
  code: "software_ai",
  "game-design": "software_ai",
  animation: "film_video",
};

/** Any medium or stored value in, canonical id out. `null` when unrecognised. */
export function canonicalForMedium(value: string | null | undefined): CanonicalCategory | null {
  if (!value) return null;
  return MEDIUM_TO_CANONICAL[value] ?? STORAGE_TO_CANONICAL[value] ?? null;
}

/**
 * Canonical id -> the stored enum values a Works/Collabs/Profiles query must
 * filter on. This is what keeps existing rows discoverable under new labels.
 */
const CANONICAL_TO_STORAGE: Partial<Record<CanonicalCategory, string[]>> = {
  music: ["music"],
  film_video: ["film", "film_video"],
  writing: ["writing", "writing_book"],
  visual_art: ["visual", "visual_art"],
  software_ai: ["build", "games_tech", "software_ai"],
  games_tech: ["build", "games_tech", "software_ai"],
  performance: ["performance"],
  audio: ["audio"],
  design: ["design"],
  journalism_media: ["journalism_media"],
  making_engineering: ["making_engineering"],
  science_research: ["science_research"],
  architecture_cities: ["architecture_cities"],
  environment_nature: ["environment_nature"],
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
  {
    id: "office_hours",
    label: "Office Hours",
    className: "bg-cat-office-hours text-cat-office-hours-ink",
  },
  { id: "roundtable", label: "Roundtable", className: "bg-cat-roundtable text-cat-roundtable-ink" },
  { id: "pitch", label: "Pitch", className: "bg-cat-pitch text-cat-pitch-ink" },
  {
    id: "listen_party",
    label: "Listen Party",
    className: "bg-cat-listen-party text-cat-listen-party-ink",
  },
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
 *
 * @deprecated Filter on the canonical columns (`categories_canonical`,
 * `category_canonical`) with `canonicalFilterValues` instead. The legacy enum
 * cannot represent design / performance / audio / scene_life / language, so
 * this returns `[]` for them and the filter silently matches nothing.
 */
export function workStorageValuesFor(canonical: string): string[] {
  const vals = storageValuesFor(canonical).filter((v) => CATEGORY_ENUM_VALUES.has(v));
  return vals.length > 0 ? vals : [];
}

/**
 * Values to match against the canonical `*_canonical` columns, which are
 * trigger-synced from the legacy enum columns by the database. `writing_book`
 * already collapses to `writing` there, so a canonical id maps to itself.
 */
export function canonicalFilterValues(value: string): CanonicalCategory[] {
  return [normalizeCategory(value)];
}

// ---------------------------------------------------------------------------
// FIELD API — the vocabulary every primitive classifies subject area with.
// ---------------------------------------------------------------------------

/**
 * Fields that have a system ("medium") Group, keyed by that Group's slug.
 *
 * The database resolves these through `groups.taxonomy_key` (see
 * `medium_group_id`), which holds canonical Field ids — the `games-tech` slug
 * is historical URL compatibility for the Software & AI group and is
 * deliberately not renamed.
 *
 * Fields absent from this map (Design, Performance, Journalism & Media,
 * Making & Engineering, Science & Research, Architecture & Cities,
 * Environment & Nature) intentionally have no system Group: content in those
 * Fields simply does not auto-file anywhere. We do not auto-create a Group per
 * Field — empty system Groups are worse than none.
 */
export const SYSTEM_FIELD_GROUP_SLUGS: Partial<Record<FieldId, string>> = {
  music: "music",
  film_video: "film-video",
  writing: "writing",
  visual_art: "visual-art",
  software_ai: "games-tech",
};

/** The system Group slug a stored/legacy/canonical value files into, if any. */
export function systemGroupSlugForField(value: string | null | undefined): string | null {
  return SYSTEM_FIELD_GROUP_SLUGS[normalizeField(value)] ?? null;
}


/** Any stored, legacy or canonical value in; a user-facing Field id out. */
export function normalizeField(value: string | null | undefined): FieldId {
  const canonical = normalizeCategory(value);
  if (isFieldId(canonical)) return canonical;
  // Legacy / community canonicals that are not Fields.
  if (canonical === "games_tech") return "software_ai";
  if (canonical === "audio") return "music";
  return "other";
}

/** Legacy stored category -> Field. Alias of `normalizeField`, named for intent. */
export const legacyCategoryToField = normalizeField;

export function fieldLabel(value: string | null | undefined): string {
  return BY_ID.get(normalizeField(value))?.label ?? "Other";
}

export function fieldClass(value: string | null | undefined): string {
  return BY_ID.get(normalizeField(value))?.className ?? "bg-muted text-ink-soft";
}

/**
 * A row's Fields, canonical-first: canonical values win, legacy stored values
 * are normalized as fallback. Deduplicated, order preserved, `other` dropped
 * unless it is all there is.
 */
export function fieldsForStoredValues(
  canonicalValues: readonly (string | null | undefined)[] | null | undefined,
  legacyValues?: readonly (string | null | undefined)[] | null,
): FieldId[] {
  const source = canonicalValues?.filter(Boolean)?.length ? canonicalValues : (legacyValues ?? []);
  const out: FieldId[] = [];
  for (const v of source ?? []) {
    if (!v) continue;
    const f = normalizeField(v);
    if (!out.includes(f)) out.push(f);
  }
  const meaningful = out.filter((f) => f !== "other");
  return meaningful.length > 0 ? meaningful : out;
}

/**
 * COMPATIBILITY ONLY — `works.category` / `collab_posts.category` are NOT NULL
 * legacy enum columns that cannot represent the modern Fields. New rows still
 * write canonical Fields as the source of truth; this picks the closest legacy
 * enum value to keep those columns satisfied and old code paths working.
 * Never show its result to a user.
 */
export function fieldToLegacyEnum(field: string | null | undefined): string {
  switch (normalizeField(field)) {
    case "music":
      return "music";
    case "film_video":
      return "film";
    case "writing":
    case "journalism_media":
      return "writing";
    case "visual_art":
    case "design":
      return "visual";
    case "software_ai":
    case "making_engineering":
    case "science_research":
      return "build";
    case "performance":
      return "other";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// FORMATS — what kind of Work was made. Stored free-form on `works.subtype`.
// Suggestions only: any Field accepts a custom Format.
// ---------------------------------------------------------------------------

export const FORMAT_SUGGESTIONS: Record<FieldId, string[]> = {
  music: ["Single", "EP / Album", "Live set", "Remix", "Demo", "Score", "Beat"],
  film_video: ["Short film", "Documentary", "Music video", "Animation", "Trailer", "Reel"],
  writing: [
    "Essay",
    "Poem",
    "Short story",
    "Book",
    "Novel",
    "Play",
    "Screenplay",
    "Zine",
    "Newsletter",
    "Article",
    "Research paper",
  ],

  visual_art: [
    "Painting",
    "Photograph",
    "Illustration",
    "Sculpture",
    "Ceramics",
    "Collage",
    "Print",
    "3D artwork",
  ],
  design: ["Identity", "Poster", "Type", "Product", "Motion", "Publication"],
  performance: ["Set", "Reading", "Showcase", "Improv", "Play"],
  journalism_media: ["Article", "Investigation", "Interview", "Report", "Photo essay", "Podcast"],
  software_ai: ["Application", "Website", "Tool", "Plugin", "Model", "Benchmark", "Library", "Game"],
  making_engineering: [
    "Hardware",
    "Prototype",
    "3D print",
    "Electronics",
    "Open hardware",
    "Installation",
  ],
  science_research: ["Research paper", "Dataset", "Experiment", "Benchmark", "Map", "Research note"],
  architecture_cities: ["Drawing", "Model", "Proposal", "Study", "Map", "Photo essay"],
  environment_nature: ["Field study", "Dataset", "Map", "Photo essay", "Report"],
  other: [],
};

/** Merged, deduplicated Format suggestions for the selected Fields. */
export function formatSuggestionsFor(fields: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    for (const s of FORMAT_SUGGESTIONS[normalizeField(f)] ?? []) {
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}

/**
 * "Book" used to be its own category (`writing_book`). It is now a Format
 * under Writing; both spellings resolve here so old rows keep their book
 * details panel.
 */
export const BOOK_FORMATS = ["Book", "Novel", "Novella", "Memoir", "Anthology"];

export function isBookWork(
  storedCategory: string | null | undefined,
  format: string | null | undefined,
): boolean {
  if (storedCategory === "writing_book") return true;
  return !!format && BOOK_FORMATS.includes(format);
}



/**
 * @deprecated Legacy alias of `FORMAT_SUGGESTIONS`, kept while callers migrate
 * from "subtype" language to "Format".
 */
export const CANONICAL_SUBTYPES: Record<string, string[]> = FORMAT_SUGGESTIONS;

