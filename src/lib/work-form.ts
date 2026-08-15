/**
 * The one Work form model — shared by "Post to Gallery" and "Edit Work".
 *
 * Both routes hydrate this shape, render the same field components
 * (`@/components/work/work-form-fields`), validate with the same schema and
 * write through the same payload builder. There is no second set of fields.
 *
 * Legacy columns (`category`, `categories`, `subtype`, `subcategories`, all
 * `book_*`) keep being written so old readers never break.
 */
import { z } from "zod";
import {
  categoryAllowedUnder,
  categoryUsesMaterial,
  detailFieldsFor,
  resolveWorkClassification,
  workCategoryById,
  type WorkDetailField,
} from "@/lib/work-categories";
import { toDateColumn } from "@/lib/work-dates";
import { normalizeMaterials, normalizeSubjects } from "@/lib/work-tags";
import { fieldWritePayload } from "@/lib/work-fields";
import { normalizeField, type FieldId } from "@/lib/taxonomy";
import { WORK_BODY_MAX } from "@/lib/work-body";

export type WorkDetails = {
  dimensions?: string;
  dimensions_unit?: string;
  duration?: string;
  piece_count?: number;
  edition?: string;
  version?: string;
  repository?: string;
  track_count?: number;
};

export const DIMENSION_UNITS = ["cm", "in", "mm", "m", "px"] as const;

export type WorkFormValues = {
  title: string;
  medium: FieldId | "";
  categoryId: string;
  excerpt: string;
  description: string;
  publicationDate: string;
  subjects: string[];
  materials: string[];
  details: WorkDetails;
  primaryUrl: string;
  embedUrl: string;
  coverUrl: string | null;
  licenseType: string;
  visibility: "public" | "unlisted";
  ownsRights: boolean;
};

export const emptyWorkForm: WorkFormValues = {
  title: "",
  // Never pre-picked: Medium must be chosen or confirmed.
  medium: "",
  categoryId: "",
  excerpt: "",
  description: "",
  publicationDate: "",
  subjects: [],
  materials: [],
  details: {},
  primaryUrl: "",
  embedUrl: "",
  coverUrl: null,
  licenseType: "portfolio_credit_only",
  visibility: "public",
  ownsRights: false,
};

export const LICENSE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "portfolio_credit_only", label: "Credit only (portfolio)" },
  { value: "cc_by", label: "CC BY" },
  { value: "rights_managed_externally", label: "Rights managed elsewhere" },
  { value: "private", label: "Private / unlisted" },
];

const detailsSchema = z
  .object({
    dimensions: z.string().max(80).optional(),
    dimensions_unit: z.string().max(8).optional(),
    duration: z.string().max(40).optional(),
    piece_count: z.number().int().min(1).max(10_000).optional(),
    edition: z.string().max(80).optional(),
    version: z.string().max(40).optional(),
    repository: z.string().max(500).optional(),
    track_count: z.number().int().min(1).max(10_000).optional(),
  })
  .strip();

export const workFormSchema = z.object({
  title: z.string().trim().min(1, "Give it a title.").max(140),
  medium: z.string().trim().min(1, "Pick a Medium."),
  categoryId: z.string().trim().min(1, "Pick a Category."),
  excerpt: z.string().max(180).default(""),
  description: z.string().max(WORK_BODY_MAX).default(""),
  publicationDate: z.string().default(""),
  subjects: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  details: detailsSchema.default({}),
  primaryUrl: z.string().max(2000).default(""),
  embedUrl: z.string().max(2000).default(""),
  coverUrl: z.string().nullable().default(null),
  licenseType: z.string().default("portfolio_credit_only"),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  ownsRights: z.boolean(),
});

/** Everything a Work row needs to hydrate the shared form. */
export type WorkFormRow = {
  title?: string | null;
  category_id?: string | null;
  subtype?: string | null;
  subcategories?: readonly (string | null)[] | null;
  category_canonical?: string | null;
  category?: string | null;
  excerpt?: string | null;
  description?: string | null;
  publication_date?: string | null;
  book_published_on?: string | null;
  subjects?: readonly string[] | null;
  materials?: readonly string[] | null;
  details?: unknown;
  primary_url?: string | null;
  embed_url?: string | null;
  cover_url?: string | null;
  license_type?: string | null;
  visibility?: string | null;
};

export function hydrateWorkForm(row: WorkFormRow): WorkFormValues {
  const cls = resolveWorkClassification(row);
  const details = (row.details && typeof row.details === "object" ? row.details : {}) as WorkDetails;
  return {
    title: row.title ?? "",
    medium: cls.medium,
    categoryId: cls.category?.id ?? "",
    excerpt: row.excerpt ?? "",
    description: row.description ?? "",
    // Books carry their official date in a legacy column; surface it here.
    publicationDate: row.publication_date ?? row.book_published_on ?? "",
    subjects: normalizeSubjects(row.subjects ?? []),
    materials: normalizeMaterials(row.materials ?? []),
    details: detailsSchema.parse(details) as WorkDetails,
    primaryUrl: row.primary_url ?? "",
    embedUrl: row.embed_url ?? "",
    coverUrl: row.cover_url ?? null,
    licenseType: row.license_type ?? "portfolio_credit_only",
    visibility: row.visibility === "unlisted" ? "unlisted" : "public",
    ownsRights: true, // an existing Work was already certified at creation
  };
}

/** Strip detail values the current Category does not ask for. */
export function pruneDetails(details: WorkDetails, categoryId: string): WorkDetails {
  const allowed = new Set<WorkDetailField>(detailFieldsFor(categoryId));
  const out: WorkDetails = {};
  if (allowed.has("dimensions")) {
    if (details.dimensions) out.dimensions = details.dimensions;
    if (details.dimensions_unit) out.dimensions_unit = details.dimensions_unit;
  }
  if (allowed.has("duration") && details.duration) out.duration = details.duration;
  if (allowed.has("piece_count") && details.piece_count) out.piece_count = details.piece_count;
  if (allowed.has("edition") && details.edition) out.edition = details.edition;
  if (allowed.has("version") && details.version) out.version = details.version;
  if (allowed.has("repository") && details.repository) out.repository = details.repository;
  if (allowed.has("track_count") && details.track_count) out.track_count = details.track_count;
  return out;
}

/**
 * A Work can go public when someone can actually see something:
 * an asset, a cover, a media/source link, or a substantive description.
 */
export function hasPresentationPath(input: {
  assetCount: number;
  coverUrl: string | null;
  primaryUrl: string;
  embedUrl: string;
  description: string;
  excerpt: string;
}): boolean {
  if (input.assetCount > 0) return true;
  if (input.coverUrl) return true;
  if (input.primaryUrl.trim() || input.embedUrl.trim()) return true;
  return input.description.trim().length >= 80 || input.excerpt.trim().length >= 40;
}

export type WorkFormIssue = { field: keyof WorkFormValues | "assets"; message: string };

/** Publish-readiness. Returns every blocking issue, in form order. */
export function validateForPublish(
  values: WorkFormValues,
  ctx: { assetCount: number },
): WorkFormIssue[] {
  const issues: WorkFormIssue[] = [];
  if (!values.title.trim()) issues.push({ field: "title", message: "Give it a title." });
  if (!values.medium) issues.push({ field: "medium", message: "Pick a Medium." });
  if (!values.categoryId) issues.push({ field: "categoryId", message: "Pick a Category." });
  if (values.medium && values.categoryId && !categoryAllowedUnder(values.categoryId, values.medium)) {
    issues.push({ field: "categoryId", message: "That Category isn't available under this Medium." });
  }
  if (!values.ownsRights) {
    issues.push({ field: "ownsRights", message: "Confirm this is your work, or you have the rights to share it." });
  }
  if (
    !hasPresentationPath({
      assetCount: ctx.assetCount,
      coverUrl: values.coverUrl,
      primaryUrl: values.primaryUrl,
      embedUrl: values.embedUrl,
      description: values.description,
      excerpt: values.excerpt,
    })
  ) {
    issues.push({
      field: "assets",
      message: "Add media, a cover, a source link, or a description so there's something to show.",
    });
  }
  return issues;
}

/**
 * Form → database columns.
 *
 * `publication_date` comes ONLY from the author's Publication date field; it is
 * never derived from `published_at`. `subtype` keeps mirroring the Category
 * label for legacy readers, and existing `subcategories` are preserved as-is.
 */
export function buildWorkWritePayload(
  values: WorkFormValues,
  opts: { existingSubcategory?: string | null } = {},
) {
  const medium = normalizeField(values.medium || null);
  const category = workCategoryById(values.categoryId);
  const fieldPayload = fieldWritePayload(medium, [], opts.existingSubcategory ?? null);
  const materials = categoryUsesMaterial(values.categoryId)
    ? normalizeMaterials(values.materials)
    : [];

  return {
    ...fieldPayload,
    title: values.title.trim(),
    category_id: category?.id ?? null,
    // Legacy mirror — book detection, old chips and exports still read this.
    subtype: category?.label ?? null,
    excerpt: values.excerpt.trim() || null,
    description: values.description.trim() || null,
    publication_date: toDateColumn(values.publicationDate),
    subjects: normalizeSubjects(values.subjects),
    materials,
    details: pruneDetails(values.details, values.categoryId),
    primary_url: values.primaryUrl.trim() || null,
    embed_url: values.embedUrl.trim() || null,
    cover_url: values.coverUrl,
    license_type: values.licenseType as
      | "cc_by"
      | "portfolio_credit_only"
      | "private"
      | "rights_managed_externally",
    visibility: values.visibility,
  };
}
