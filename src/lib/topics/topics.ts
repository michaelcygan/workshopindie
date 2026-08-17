/**
 * Topics and Mediums — the canonical "what is this about / what is it made of"
 * layer shared by Blog posts, Works, Groups, Collabs, and Events.
 *
 * Topic  — a canonical subject (`public.topics`), author-created, deduped by slug.
 * Medium — the creative Field a piece belongs to, given a public hub page
 *          (`public.mediums`, one row per canonical Field id).
 *
 * Client-safe: no server imports.
 */
import { FIELD_IDS, fieldLabel, type FieldId } from "@/lib/taxonomy";

export type Topic = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  about_markdown?: string | null;
  featured?: boolean;
};

export type Medium = {
  field_id: FieldId;
  slug: string;
  label: string;
  short_description: string | null;
  about_markdown?: string | null;
  featured?: boolean;
};

/** Canonical slug for a Topic name. Stable across casing and punctuation. */
export function topicSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "topic"
  );
}

/** Trimmed, deduped (by slug), capped list of Topic names. */
export function normalizeTopicNames(values: unknown, max = 5): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name) continue;
    const slug = topicSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Mediums                                                                     */
/* -------------------------------------------------------------------------- */

/** Medium slug for a Field id. Mirrors what the migration seeded. */
export function mediumSlugForField(fieldId: string): string {
  if (fieldId === "other") return "general";
  return fieldId.replace(/_/g, "-");
}

export function fieldIdForMediumSlug(slug: string): FieldId | null {
  const normalized = slug.trim().toLowerCase();
  if (normalized === "general") return "other";
  const guess = normalized.replace(/-/g, "_");
  return (FIELD_IDS as readonly string[]).includes(guess) ? (guess as FieldId) : null;
}

export function mediumLabel(fieldId: string): string {
  return fieldId === "other" ? "General" : fieldLabel(fieldId as FieldId);
}

export const MEDIUM_LIST: Array<{ fieldId: FieldId; slug: string; label: string }> = (
  FIELD_IDS as readonly FieldId[]
).map((id) => ({ fieldId: id, slug: mediumSlugForField(id), label: mediumLabel(id) }));

/* -------------------------------------------------------------------------- */
/* URLs                                                                        */
/* -------------------------------------------------------------------------- */

export const topicUrl = (slug: string) => `/topics/${slug}`;
export const mediumUrl = (slug: string) => `/mediums/${slug}`;
