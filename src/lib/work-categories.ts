/**
 * Work Category registry — the precise kind of a Work.
 *
 * Two levels, and they are never swapped:
 *   Medium   = the broad creative lane  (canonical Field, e.g. `film_video` → "Film & Video")
 *   Category = the precise kind of Work (e.g. `trailer` → "Trailer")
 *
 * Storage:
 *   Medium   → `works.category_canonical` / `categories_canonical` (plus the
 *              legacy `category` / `categories` enum columns kept in sync).
 *   Category → `works.category_id` (stable id). The label keeps being mirrored
 *              into the legacy free-text `works.subtype` column so every old
 *              reader (book detection, format chips, exports) keeps working.
 *
 * Nothing here rewrites storage. Legacy rows resolve through `aliases` and the
 * fallback ladder in `resolveWorkClassification`, so a Work with incomplete
 * metadata always renders.
 */
import { FIELD_IDS, fieldLabel, normalizeField, type FieldId } from "@/lib/taxonomy";

/** Category-driven factual fields. Kept separate from Subject/Material tags. */
export type WorkDetailField =
  | "dimensions"
  | "duration"
  | "piece_count"
  | "edition"
  | "version"
  | "repository"
  | "track_count";

export type WorkAssetHint = "image" | "video" | "audio" | "document" | "model" | "link";

export type WorkCategoryEntry = {
  /** Stable id written to `works.category_id`. Never renamed. */
  id: string;
  /** Public label. Also mirrored into the legacy `subtype` column. */
  label: string;
  /** Mediums this Category is offered under. A Category may span several. */
  mediums: FieldId[];
  /** Legacy `subtype` strings / subcategory ids that map here with confidence. */
  aliases?: string[];
  /** Conditional factual fields the authoring form should offer. */
  detailFields?: WorkDetailField[];
  /** What the media composer should nudge the author to upload. */
  suggestedAssets?: WorkAssetHint[];
  /** Physical Work: offer the Material field. Off by default. */
  material?: boolean;
};

export const WORK_CATEGORIES: readonly WorkCategoryEntry[] = [
  // ---- Film & Video -------------------------------------------------------
  { id: "trailer", label: "Trailer", mediums: ["film_video"], detailFields: ["duration"], suggestedAssets: ["video", "link"] },
  { id: "short_film", label: "Short film", mediums: ["film_video"], aliases: ["Short film", "Short"], detailFields: ["duration"], suggestedAssets: ["video", "link"] },
  { id: "feature_film", label: "Feature film", mediums: ["film_video"], detailFields: ["duration"], suggestedAssets: ["video", "link"] },
  { id: "documentary", label: "Documentary", mediums: ["film_video", "journalism_media"], aliases: ["Documentary"], detailFields: ["duration"], suggestedAssets: ["video", "link"] },
  { id: "music_video", label: "Music video", mediums: ["film_video", "music"], aliases: ["Music video"], detailFields: ["duration"], suggestedAssets: ["video", "link"] },
  { id: "animation", label: "Animation", mediums: ["film_video", "design"], aliases: ["Animation", "Motion"], detailFields: ["duration"], suggestedAssets: ["video"] },
  { id: "reel", label: "Reel", mediums: ["film_video"], aliases: ["Reel"], detailFields: ["duration"], suggestedAssets: ["video"] },

  // ---- Music & Audio ------------------------------------------------------
  { id: "single", label: "Single", mediums: ["music"], aliases: ["Single"], detailFields: ["duration"], suggestedAssets: ["audio", "link"] },
  { id: "album", label: "Album / EP", mediums: ["music"], aliases: ["EP / Album", "Album", "EP"], detailFields: ["track_count", "duration"], suggestedAssets: ["audio", "image"] },
  { id: "live_set", label: "Live set", mediums: ["music", "performance"], aliases: ["Live set", "Set"], detailFields: ["duration"], suggestedAssets: ["audio", "video"] },
  { id: "remix", label: "Remix", mediums: ["music"], aliases: ["Remix"], detailFields: ["duration"], suggestedAssets: ["audio"] },
  { id: "demo", label: "Demo", mediums: ["music"], aliases: ["Demo"], detailFields: ["duration"], suggestedAssets: ["audio"] },
  { id: "score", label: "Score", mediums: ["music"], aliases: ["Score"], detailFields: ["duration"], suggestedAssets: ["audio", "document"] },
  { id: "beat", label: "Beat", mediums: ["music"], aliases: ["Beat"], detailFields: ["duration"], suggestedAssets: ["audio"] },
  { id: "podcast", label: "Podcast", mediums: ["music", "journalism_media"], aliases: ["Podcast"], detailFields: ["duration", "track_count"], suggestedAssets: ["audio", "link"] },

  // ---- Writing & Publishing ----------------------------------------------
  { id: "book", label: "Book", mediums: ["writing"], aliases: ["Book", "Novel", "Novella", "Memoir", "Anthology"], suggestedAssets: ["image", "document", "link"] },
  { id: "essay", label: "Essay", mediums: ["writing", "journalism_media"], aliases: ["Essay"], suggestedAssets: ["document", "link"] },
  { id: "poem", label: "Poem", mediums: ["writing"], aliases: ["Poem"], suggestedAssets: ["document"] },
  { id: "short_story", label: "Short story", mediums: ["writing"], aliases: ["Short story"], suggestedAssets: ["document"] },
  { id: "screenplay", label: "Screenplay", mediums: ["writing", "film_video"], aliases: ["Screenplay"], suggestedAssets: ["document"] },
  { id: "play_script", label: "Play / script", mediums: ["writing", "performance"], aliases: ["Play", "Script"], suggestedAssets: ["document"] },
  { id: "zine", label: "Zine", mediums: ["writing", "visual_art", "design"], aliases: ["Zine"], detailFields: ["piece_count", "edition"], suggestedAssets: ["image", "document"], material: true },
  { id: "newsletter", label: "Newsletter", mediums: ["writing", "journalism_media"], aliases: ["Newsletter"], suggestedAssets: ["link"] },
  { id: "article", label: "Article", mediums: ["writing", "journalism_media"], aliases: ["Article"], suggestedAssets: ["link", "document"] },

  // ---- Visual Art & Photography ------------------------------------------
  { id: "painting", label: "Painting", mediums: ["visual_art"], aliases: ["Painting"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },
  { id: "painting_series", label: "Painting series", mediums: ["visual_art"], detailFields: ["piece_count", "dimensions"], suggestedAssets: ["image"], material: true },
  { id: "photograph", label: "Photograph", mediums: ["visual_art"], aliases: ["Photograph"], detailFields: ["dimensions", "edition"], suggestedAssets: ["image"], material: true },
  { id: "photo_series", label: "Photo series", mediums: ["visual_art", "journalism_media"], aliases: ["Photo essay"], detailFields: ["piece_count"], suggestedAssets: ["image"] },
  { id: "illustration", label: "Illustration", mediums: ["visual_art", "design"], aliases: ["Illustration"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },
  { id: "sculpture", label: "Sculpture", mediums: ["visual_art", "making_engineering"], aliases: ["Sculpture"], detailFields: ["dimensions", "edition"], suggestedAssets: ["image", "model"], material: true },
  { id: "ceramics", label: "Ceramic work", mediums: ["visual_art", "making_engineering"], aliases: ["Ceramics"], detailFields: ["dimensions", "piece_count"], suggestedAssets: ["image"], material: true },
  { id: "collage", label: "Collage", mediums: ["visual_art"], aliases: ["Collage"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },
  { id: "print", label: "Print", mediums: ["visual_art", "design"], aliases: ["Print"], detailFields: ["dimensions", "edition"], suggestedAssets: ["image"], material: true },
  { id: "artwork_3d", label: "3D artwork", mediums: ["visual_art", "design"], aliases: ["3D artwork"], suggestedAssets: ["model", "image"] },
  { id: "installation", label: "Installation", mediums: ["visual_art", "making_engineering", "architecture_cities"], aliases: ["Installation"], detailFields: ["dimensions"], suggestedAssets: ["image", "video"], material: true },
  { id: "textile", label: "Textile work", mediums: ["visual_art", "making_engineering"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },

  // ---- Design -------------------------------------------------------------
  { id: "identity", label: "Identity", mediums: ["design"], aliases: ["Identity"], suggestedAssets: ["image"] },
  { id: "poster", label: "Poster", mediums: ["design", "visual_art"], aliases: ["Poster"], detailFields: ["dimensions", "edition"], suggestedAssets: ["image"], material: true },
  { id: "typeface", label: "Typeface", mediums: ["design"], aliases: ["Type"], suggestedAssets: ["image", "link"] },
  { id: "product_design", label: "Product design", mediums: ["design", "making_engineering"], aliases: ["Product"], detailFields: ["dimensions"], suggestedAssets: ["image", "model"], material: true },
  { id: "publication", label: "Publication", mediums: ["design", "writing"], aliases: ["Publication"], detailFields: ["piece_count"], suggestedAssets: ["image", "document"], material: true },

  // ---- Performance --------------------------------------------------------
  { id: "reading", label: "Reading", mediums: ["performance", "writing"], aliases: ["Reading"], detailFields: ["duration"], suggestedAssets: ["video", "audio"] },
  { id: "showcase", label: "Showcase", mediums: ["performance"], aliases: ["Showcase"], detailFields: ["duration"], suggestedAssets: ["video", "image"] },
  { id: "improv", label: "Improv", mediums: ["performance"], aliases: ["Improv"], detailFields: ["duration"], suggestedAssets: ["video"] },
  { id: "dance", label: "Dance", mediums: ["performance"], detailFields: ["duration"], suggestedAssets: ["video"] },

  // ---- Journalism & Media -------------------------------------------------
  { id: "investigation", label: "Investigation", mediums: ["journalism_media"], aliases: ["Investigation"], suggestedAssets: ["link", "document"] },
  { id: "interview", label: "Interview", mediums: ["journalism_media"], aliases: ["Interview"], detailFields: ["duration"], suggestedAssets: ["link", "audio", "video"] },
  { id: "report", label: "Report", mediums: ["journalism_media", "science_research", "environment_nature"], aliases: ["Report"], suggestedAssets: ["document", "link"] },

  // ---- Software & AI ------------------------------------------------------
  { id: "application", label: "Application", mediums: ["software_ai"], aliases: ["Application"], detailFields: ["version", "repository"], suggestedAssets: ["link", "image"] },
  { id: "website", label: "Website", mediums: ["software_ai", "design"], aliases: ["Website"], detailFields: ["repository"], suggestedAssets: ["link", "image"] },
  { id: "tool", label: "Tool", mediums: ["software_ai"], aliases: ["Tool", "Plugin"], detailFields: ["version", "repository"], suggestedAssets: ["link"] },
  { id: "library", label: "Library", mediums: ["software_ai"], aliases: ["Library"], detailFields: ["version", "repository"], suggestedAssets: ["link"] },
  { id: "model", label: "Model", mediums: ["software_ai", "science_research"], aliases: ["Model"], detailFields: ["version", "repository"], suggestedAssets: ["link"] },
  { id: "game", label: "Game", mediums: ["software_ai", "design"], aliases: ["Game"], detailFields: ["version", "repository"], suggestedAssets: ["link", "video", "image"] },
  { id: "repository", label: "Repository", mediums: ["software_ai", "science_research"], detailFields: ["repository", "version"], suggestedAssets: ["link"] },

  // ---- Making, Craft & Engineering ---------------------------------------
  { id: "hardware", label: "Hardware", mediums: ["making_engineering"], aliases: ["Hardware", "Open hardware", "Electronics"], detailFields: ["dimensions", "version"], suggestedAssets: ["image", "document"], material: true },
  { id: "prototype", label: "Prototype", mediums: ["making_engineering", "design"], aliases: ["Prototype"], detailFields: ["dimensions", "version"], suggestedAssets: ["image", "model"], material: true },
  { id: "print_3d", label: "3D print", mediums: ["making_engineering"], aliases: ["3D print"], detailFields: ["dimensions"], suggestedAssets: ["model", "image"], material: true },
  { id: "furniture", label: "Furniture", mediums: ["making_engineering", "design"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },

  // ---- Science & Research -------------------------------------------------
  { id: "research_paper", label: "Research paper", mediums: ["science_research", "writing"], aliases: ["Research paper"], suggestedAssets: ["document", "link"] },
  { id: "dataset", label: "Dataset", mediums: ["science_research", "environment_nature", "software_ai"], aliases: ["Dataset"], detailFields: ["version", "repository"], suggestedAssets: ["link", "document"] },
  { id: "experiment", label: "Experiment", mediums: ["science_research"], aliases: ["Experiment"], suggestedAssets: ["document", "image"] },
  { id: "benchmark", label: "Benchmark", mediums: ["science_research", "software_ai"], aliases: ["Benchmark"], detailFields: ["version", "repository"], suggestedAssets: ["link"] },
  { id: "process_note", label: "Process note", mediums: ["science_research"], aliases: ["Research note", "Process note"], suggestedAssets: ["document"] },
  { id: "field_study", label: "Field study", mediums: ["environment_nature", "science_research"], aliases: ["Field study"], suggestedAssets: ["document", "image"] },

  // ---- Architecture & Urbanism -------------------------------------------
  { id: "drawing", label: "Drawing", mediums: ["architecture_cities", "visual_art"], aliases: ["Drawing"], detailFields: ["dimensions"], suggestedAssets: ["image"], material: true },
  { id: "physical_model", label: "Model (physical)", mediums: ["architecture_cities", "making_engineering"], detailFields: ["dimensions"], suggestedAssets: ["image", "model"], material: true },
  { id: "proposal", label: "Proposal", mediums: ["architecture_cities"], aliases: ["Proposal"], suggestedAssets: ["document", "image"] },
  { id: "study", label: "Study", mediums: ["architecture_cities", "science_research"], aliases: ["Study"], suggestedAssets: ["document", "image"] },
  { id: "map", label: "Map", mediums: ["architecture_cities", "environment_nature", "science_research"], aliases: ["Map"], suggestedAssets: ["image", "link"] },

  // ---- Anything else ------------------------------------------------------
  { id: "other_work", label: "Other", mediums: [...FIELD_IDS], suggestedAssets: ["image", "link"] },
] as const;

const BY_ID = new Map(WORK_CATEGORIES.map((c) => [c.id, c]));

const BY_ALIAS = (() => {
  const m = new Map<string, WorkCategoryEntry>();
  for (const c of WORK_CATEGORIES) {
    m.set(c.label.toLowerCase(), c);
    m.set(c.id.toLowerCase(), c);
    for (const a of c.aliases ?? []) if (!m.has(a.toLowerCase())) m.set(a.toLowerCase(), c);
  }
  return m;
})();

export function workCategoryById(id: string | null | undefined): WorkCategoryEntry | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/** Match a legacy free-text Format / subcategory string onto a Category. */
export function workCategoryByAlias(value: string | null | undefined): WorkCategoryEntry | null {
  if (!value) return null;
  const direct = BY_ALIAS.get(value.trim().toLowerCase());
  if (direct) return direct;
  // Subcategory ids arrive kebab-cased ("music-video"); normalize separators.
  const loose = value.trim().toLowerCase().replaceAll("-", " ").replaceAll("_", " ");
  for (const [k, v] of BY_ALIAS) {
    if (k.replaceAll("-", " ").replaceAll("_", " ") === loose) return v;
  }
  return null;
}

export function workCategoryLabel(id: string | null | undefined): string | null {
  return workCategoryById(id)?.label ?? null;
}

/** Categories offered under a Medium, "Other" last. */
export function categoriesForMedium(medium: string | null | undefined): WorkCategoryEntry[] {
  const m = normalizeField(medium);
  return WORK_CATEGORIES.filter((c) => c.id !== "other_work" && c.mediums.includes(m)).concat(
    BY_ID.get("other_work")!,
  );
}

export function categoryAllowedUnder(
  categoryId: string | null | undefined,
  medium: string | null | undefined,
): boolean {
  const c = workCategoryById(categoryId);
  if (!c) return false;
  return c.mediums.includes(normalizeField(medium));
}

export type ClassificationSource = "category_id" | "subtype" | "subcategory" | "medium";

export type WorkClassification = {
  medium: FieldId;
  mediumLabel: string;
  category: WorkCategoryEntry | null;
  categoryLabel: string | null;
  /** How the Category was resolved. `medium` means it is still unclassified. */
  source: ClassificationSource;
  /** Author-facing prompt: this Work predates the Category registry. */
  needsClassification: boolean;
};

type ClassifiableRow = {
  category_id?: string | null;
  subtype?: string | null;
  subcategories?: readonly (string | null)[] | null;
  category_canonical?: string | null;
  category?: string | null;
  categories_canonical?: readonly (string | null)[] | null;
  categories?: readonly (string | null)[] | null;
};

/**
 * Resolve Medium + Category for any Work row, new or ancient.
 * Order: stable `category_id` → legacy `subtype` → subcategory alias → Medium only.
 */
export function resolveWorkClassification(row: ClassifiableRow | null | undefined): WorkClassification {
  const medium = normalizeField(row?.category_canonical ?? row?.category ?? null);
  const base = { medium, mediumLabel: fieldLabel(medium) };

  const byId = workCategoryById(row?.category_id ?? null);
  if (byId) {
    return { ...base, category: byId, categoryLabel: byId.label, source: "category_id", needsClassification: false };
  }
  const bySubtype = workCategoryByAlias(row?.subtype ?? null);
  if (bySubtype) {
    return { ...base, category: bySubtype, categoryLabel: bySubtype.label, source: "subtype", needsClassification: true };
  }
  // A free-text subtype we cannot map is still better than nothing on screen.
  const rawSubtype = (row?.subtype ?? "").trim();
  if (rawSubtype) {
    return { ...base, category: null, categoryLabel: rawSubtype, source: "subtype", needsClassification: true };
  }
  for (const sub of row?.subcategories ?? []) {
    const bySub = workCategoryByAlias(sub);
    if (bySub) {
      return { ...base, category: bySub, categoryLabel: bySub.label, source: "subcategory", needsClassification: true };
    }
  }
  return { ...base, category: null, categoryLabel: null, source: "medium", needsClassification: true };
}

/** "TRAILER · FILM & VIDEO" — the shared card/page eyebrow. */
export function classificationEyebrow(row: ClassifiableRow | null | undefined): string {
  const c = resolveWorkClassification(row);
  return (c.categoryLabel ? `${c.categoryLabel} · ${c.mediumLabel}` : c.mediumLabel).toUpperCase();
}

/** Material only applies to Work that is physically made from something. */
export function categoryUsesMaterial(categoryId: string | null | undefined): boolean {
  return workCategoryById(categoryId)?.material === true;
}

export function detailFieldsFor(categoryId: string | null | undefined): WorkDetailField[] {
  return [...(workCategoryById(categoryId)?.detailFields ?? [])];
}

export const DETAIL_FIELD_LABELS: Record<WorkDetailField, string> = {
  dimensions: "Dimensions",
  duration: "Duration",
  piece_count: "Number of pieces",
  edition: "Edition",
  version: "Version",
  repository: "Repository",
  track_count: "Tracks / episodes",
};
