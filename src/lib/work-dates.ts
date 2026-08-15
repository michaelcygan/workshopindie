/**
 * Work dates. Four distinct things that must never be conflated:
 *
 *   publication_date  the Work's OFFICIAL public date (release, premiere, issue)
 *   published_at      when the Work was posted to Workshop  → "Posted to Workshop"
 *   created_at        Workshop record creation
 *   updated_at        Workshop record modification
 *
 * `publication_date` is never derived from `published_at`. Gallery recency and
 * feed ordering keep using `published_at`.
 */

export const PUBLICATION_DATE_HELP =
  "The date this Work was officially published, released, premiered, issued, or made public — not the date it was added to Workshop.";

export const POSTED_TO_WORKSHOP_LABEL = "Posted to Workshop";

type DatedWorkRow = {
  publication_date?: string | null;
  /** Legacy, book-only official publication date. Preserved, never destroyed. */
  book_published_on?: string | null;
};

/**
 * The Work's official publication date, with the legacy Book column as a
 * compatible fallback. Returns `null` when unknown — never a Workshop stamp.
 */
export function officialPublicationDate(row: DatedWorkRow | null | undefined): string | null {
  const d = row?.publication_date ?? row?.book_published_on ?? null;
  return d && d.trim() ? d : null;
}

/** `datePublished` for structured data: official date when known, else the Workshop stamp. */
export function structuredDatePublished(
  row: (DatedWorkRow & { published_at?: string | null; created_at?: string | null }) | null | undefined,
): string | undefined {
  return officialPublicationDate(row) ?? row?.published_at ?? row?.created_at ?? undefined;
}

/** Display an ISO date (`2025-04-12`) without dragging it through a timezone. */
export function formatPublicationDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** Normalize a date input value for storage. Empty string → null. */
export function toDateColumn(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
