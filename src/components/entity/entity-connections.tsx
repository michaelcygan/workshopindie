import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EntityReferenceChip } from "@/components/entity/entity-reference-chip";
import type { WorkshopEntityRef } from "@/lib/entities/kinds";
import { listEntityReferences } from "@/lib/entities/references.functions";

/**
 * "Connected on Workshop" — the shared reverse-reference row.
 *
 * Whatever else on Workshop points at this entity (the Collab it came out of,
 * the Groups it lives in, the Events it was shown at) rendered with the same
 * chip used inline in Today, Lounge and DMs. Renders nothing when there is
 * nothing to show, so it never leaves an empty heading behind.
 */
export function EntityConnections({
  kind,
  entityId,
  heading = "Connected on Workshop",
  className,
  limitPerKind = 6,
}: {
  kind: "work" | "collab" | "group" | "event" | "post";
  entityId: string;
  heading?: string;
  className?: string;
  limitPerKind?: number;
}) {
  const listFn = useServerFn(listEntityReferences);
  const q = useQuery({
    queryKey: ["entity-references", kind, entityId, limitPerKind],
    queryFn: () => listFn({ data: { kind, entityId, limitPerKind } }),
    staleTime: 60_000,
  });

  const data = q.data;
  const refs: WorkshopEntityRef[] = data
    ? [...data.collabs, ...data.works, ...data.groups, ...data.events, ...data.profiles]
    : [];
  if (refs.length === 0) return null;

  return (
    <section className={className ?? "mt-8"}>
      <h3 className="mb-2 font-display text-lg text-ink">{heading}</h3>
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
    </section>
  );
}
