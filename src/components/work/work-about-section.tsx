/**
 * "About this Work" — the public metadata + related-entity section on a
 * Gallery Page. Renders only rows that actually have content, and names each
 * relationship row explicitly instead of hiding them behind "Connections".
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EntityReferenceChip } from "@/components/entity/entity-reference-chip";
import { listEntityReferences } from "@/lib/entities/references.functions";
import type { WorkshopEntityRef } from "@/lib/entities/kinds";
import {
  DETAIL_FIELD_LABELS,
  resolveWorkClassification,
  type WorkDetailField,
} from "@/lib/work-categories";
import { formatPublicationDate, officialPublicationDate } from "@/lib/work-dates";
import type { WorkDetails } from "@/lib/work-form";

const LICENSE_LABELS: Record<string, string> = {
  cc_by: "CC BY",
  rights_managed_externally: "Rights managed",
  portfolio_credit_only: "Credit only",
  private: "Private",
};

export type WorkAboutRow = {
  id: string;
  category_id?: string | null;
  subtype?: string | null;
  subcategories?: string[] | null;
  category_canonical?: string | null;
  category?: string | null;
  subjects?: string[] | null;
  materials?: string[] | null;
  details?: unknown;
  publication_date?: string | null;
  book_published_on?: string | null;
  primary_url?: string | null;
  license_type?: string | null;
  city?: { name: string; country: string | null } | null;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function ChipRow({ label, refs }: { label: string; refs: WorkshopEntityRef[] }) {
  if (refs.length === 0) return null;
  return (
    <Row label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {refs.map((r) => (
          <EntityReferenceChip
            key={`${r.kind}:${r.id}`}
            kind={r.kind}
            id={r.id}
            label={r.label}
            slug={r.kind === "profile" ? r.username : r.slug}
            groupSlug={r.kind === "event" ? r.groupSlug : undefined}
          />
        ))}
      </div>
    </Row>
  );
}

function detailValue(details: WorkDetails, field: WorkDetailField): string | null {
  switch (field) {
    case "dimensions":
      return details.dimensions
        ? `${details.dimensions}${details.dimensions_unit ? ` ${details.dimensions_unit}` : ""}`
        : null;
    case "duration":
      return details.duration ?? null;
    case "piece_count":
      return details.piece_count ? String(details.piece_count) : null;
    case "track_count":
      return details.track_count ? String(details.track_count) : null;
    case "edition":
      return details.edition ?? null;
    case "version":
      return details.version ?? null;
    case "repository":
      return details.repository ?? null;
  }
}

export function WorkAboutSection({
  work,
  className,
}: {
  work: WorkAboutRow;
  className?: string;
}) {
  const cls = resolveWorkClassification(work);
  const details = (work.details && typeof work.details === "object" ? work.details : {}) as WorkDetails;
  const subjects = work.subjects ?? [];
  const materials = work.materials ?? [];
  const pubDate = formatPublicationDate(officialPublicationDate(work));
  const license = work.license_type ? LICENSE_LABELS[work.license_type] ?? work.license_type.replaceAll("_", " ") : null;

  const listFn = useServerFn(listEntityReferences);
  const refsQuery = useQuery({
    queryKey: ["entity-references", "work", work.id, 6],
    queryFn: () => listFn({ data: { kind: "work" as const, entityId: work.id, limitPerKind: 6 } }),
    staleTime: 60_000,
  });
  const refs = refsQuery.data;

  const detailEntries = (Object.keys(DETAIL_FIELD_LABELS) as WorkDetailField[])
    .map((f) => [f, detailValue(details, f)] as const)
    .filter((e): e is readonly [WorkDetailField, string] => !!e[1]);

  const hasRelationships =
    !!refs &&
    (refs.works.length > 0 ||
      refs.collabs.length > 0 ||
      refs.groups.length > 0 ||
      refs.events.length > 0);

  const hasMeta =
    !!cls.categoryLabel ||
    !!pubDate ||
    subjects.length > 0 ||
    materials.length > 0 ||
    detailEntries.length > 0 ||
    !!work.city ||
    !!work.primary_url ||
    !!license;

  if (!hasMeta && !hasRelationships) return null;

  return (
    <section className={className ?? "mt-14"}>
      <h2 className="font-display text-2xl text-ink">About this Work</h2>
      <dl className="mt-4 rounded-2xl border border-border bg-surface px-4 py-1">
        <Row label="Field">{cls.fieldLabels.join(" · ")}</Row>
        {cls.categoryLabel && <Row label="Category">{cls.categoryLabel}</Row>}
        {pubDate && <Row label="Publication date">{pubDate}</Row>}
        {subjects.length > 0 && <Row label="Subject">{subjects.join(", ")}</Row>}
        {materials.length > 0 && <Row label="Material">{materials.join(", ")}</Row>}
        {detailEntries.map(([f, v]) => (
          <Row key={f} label={DETAIL_FIELD_LABELS[f]}>
            {f === "repository" ? (
              <a href={v} target="_blank" rel="noreferrer noopener" className="break-all text-signal hover:underline">
                {v}
              </a>
            ) : (
              v
            )}
          </Row>
        ))}
        {work.city && (
          <Row label="Location">
            {work.city.name}
            {work.city.country ? `, ${work.city.country}` : ""}
          </Row>
        )}
        {work.primary_url && (
          <Row label="Source">
            <a
              href={work.primary_url}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-signal hover:underline"
            >
              {work.primary_url}
            </a>
          </Row>
        )}
        {license && <Row label="License">{license}</Row>}

        {refs && (
          <>
            <ChipRow label="Related Work" refs={refs.works} />
            <ChipRow label="Collabs" refs={refs.collabs} />
            <ChipRow label="Groups" refs={refs.groups} />
            <ChipRow label="Events" refs={refs.events} />
          </>
        )}
      </dl>
    </section>
  );
}
