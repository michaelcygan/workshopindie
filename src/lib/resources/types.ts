/**
 * Resources primitive — v1.
 *
 * A Resource is a place, service or organization useful to Workshop members.
 * Resources are attached to Groups through `group_resources`, so the same
 * Resource can be surfaced by multiple Groups (and, later, a global Directory).
 */

export const RESOURCE_CATEGORIES = [
  { id: "supply", label: "Creative supplies" },
  { id: "studio", label: "Studio" },
  { id: "rental", label: "Equipment rental" },
  { id: "lab", label: "Film & photo lab" },
  { id: "fabrication", label: "Fabrication shop" },
  { id: "rehearsal", label: "Rehearsal space" },
  { id: "printing", label: "Printing & framing" },
  { id: "repair", label: "Repair service" },
  { id: "services", label: "Professional services" },
  { id: "organization", label: "Arts organization" },
  { id: "funding", label: "Funding" },
  { id: "education", label: "Education" },
  { id: "other", label: "Other" },
] as const;

export type ResourceCategoryId = (typeof RESOURCE_CATEGORIES)[number]["id"];

export const RESOURCE_CATEGORY_IDS = RESOURCE_CATEGORIES.map((c) => c.id) as ResourceCategoryId[];

export function resourceCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return RESOURCE_CATEGORIES.find((c) => c.id === value)?.label ?? value;
}

export type ResourceRow = {
  id: string;
  name: string;
  category: string | null;
  useful_for: string | null;
  short_description: string | null;
  website_url: string | null;
  location_text: string | null;
  address: string | null;
  image_url: string | null;
  city_id: string | null;
  fields: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
};
