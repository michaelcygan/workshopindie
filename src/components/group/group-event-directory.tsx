/**
 * The Group Event Directory — a public, filterable projection of the Event
 * objects connected to a Group.
 *
 * There is no directory object. The Event is the primitive; this reads every
 * event linked to the Group through `event_groups` (which always contains the
 * primary group, guaranteed by the `ensure_primary_event_group` trigger) so an
 * event chosen under "Also show in" really does appear here.
 *
 * Filter state lives in the URL so a filtered view is a durable, shareable
 * public address.
 */
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DISCOVERABLE_STATUSES, collapseSeries, effectiveEndMs } from "@/lib/events/filters";
import {
  eventKindLabel,
  matchesAttendance,
  ATTENDANCE_OPTIONS,
  type AttendanceFilter,
} from "@/lib/events/kinds";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterSearch,
  FilterSelect,
} from "@/components/filter-header";
import { FIELD_OPTIONS, categoryLabel, normalizeField, subcategoryLabel } from "@/lib/taxonomy";
import { useEventsRealtime } from "@/hooks/use-events-realtime";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";


export type DirectoryGroup = {
  id: string;
  slug: string;
  name: string;
  kind: "city" | "genre" | "micro" | "scene";
};

export type EventLite = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  kind: string;
  creative_category: string | null;
  subcategory: string | null;
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  starts_at: string;
  ends_at?: string | null;
  series_key?: string | null;
  venue_name: string | null;
  venue_address: string | null;
  going_count: number;
  capacity: number | null;
  featured_at: string | null;
  source: "workshop" | "external" | null;
  external_url: string | null;
  external_organizer: string | null;
  is_recurring: boolean | null;
  recurrence_label: string | null;
  pinned_at: string | null;
  online_url: string | null;
  /** Owning group slug — an event linked here may live on another Group. */
  group_slug: string;
};

export type DirectoryFilters = {
  category: string | null;
  kind: string | null;
  format: AttendanceFilter;
  /** Canonical Topic slug, or null for all. */
  topic?: string | null;
  q: string;
};

const EVENT_COLUMNS =
  "id,slug,title,tagline,kind,creative_category,subcategory,format,cover_url,starts_at,ends_at,venue_name,venue_address,going_count,capacity,featured_at,source,external_url,external_organizer,is_recurring,recurrence_label,pinned_at,online_url,series_key,group_id";

/** Every event connected to this Group, deduplicated and series-collapsed. */
export function useGroupDirectoryEvents(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId, "directory-events"],
    queryFn: async (): Promise<EventLite[]> => {
      const { data: links, error: linkErr } = await supabase
        .from("event_groups")
        .select("event_id")
        .eq("group_id", groupId);
      if (linkErr) throw linkErr;
      const ids = Array.from(new Set((links ?? []).map((l) => l.event_id as string)));
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("group_events")
        .select(`${EVENT_COLUMNS},group:groups!group_events_group_id_fkey(slug,deleted_at)`)
        .in("id", ids)
        .in("status", DISCOVERABLE_STATUSES as never)
        .not("published_at", "is", null)
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true });
      if (error) throw error;

      type Row = Omit<EventLite, "group_slug"> & {
        group: { slug: string; deleted_at: string | null } | null;
      };
      const seen = new Set<string>();
      const rows: EventLite[] = [];
      for (const r of (data ?? []) as unknown as Row[]) {
        if (!r.group || r.group.deleted_at || !r.group.slug) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const { group, ...rest } = r;
        rows.push({ ...rest, group_slug: group.slug });
      }
      // A recurring night contributes one card: its nearest occurrence.
      return collapseSeries(rows);
    },
  });
}

/**
 * Count of still-current events for the section bar. Shares the directory
 * query, so the badge is free once either surface has loaded, and uses the
 * same series collapsing — a weekly night counts once.
 */
export function useGroupUpcomingEventCount(groupId: string) {
  const { data = [] } = useGroupDirectoryEvents(groupId);
  const now = Date.now();
  return data.filter((e) => effectiveEndMs(e) >= now).length;
}

export function directoryHeading(group: DirectoryGroup): string {
  return group.kind === "city" ? `Independent events in ${group.name}` : `Events in ${group.name}`;
}

export function directorySubheading(group: DirectoryGroup): string {
  return group.kind === "city"
    ? "Open mics, screenings, workshops, meetups, shows, and other places to connect."
    : "Gatherings, workshops, and events connected to this community.";
}

export function GroupEventDirectory({
  group,
  filters,
  onFiltersChange,
  variant = "page",
  limit,
}: {
  group: DirectoryGroup;
  filters: DirectoryFilters;
  onFiltersChange: (next: Partial<DirectoryFilters>) => void;
  /** "embedded" renders inside the Group shell: no page heading, capped lists. */
  variant?: "page" | "embedded";
  /** Max cards per section when embedded. */
  limit?: number;
}) {

  useEventsRealtime(group.id);
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: events, isLoading } = useGroupDirectoryEvents(group.id);

  const all = events ?? [];
  const now = Date.now();

  // Canonical Topics attached to this Group's events power the Topic pill.
  const eventIds = all.map((e) => e.id).sort();
  const { data: topicData } = useQuery({
    queryKey: ["group-events-topics", eventIds.join(",")],
    enabled: eventIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_event_topics")
        .select("event_id,topic:topics(slug,name)")
        .in("event_id", eventIds);
      if (error) throw error;
      const byEvent = new Map<string, string[]>();
      const names = new Map<string, string>();
      for (const row of (data ?? []) as unknown as {
        event_id: string;
        topic: { slug: string; name: string } | null;
      }[]) {
        if (!row.topic) continue;
        names.set(row.topic.slug, row.topic.name);
        const cur = byEvent.get(row.event_id);
        if (cur) cur.push(row.topic.slug);
        else byEvent.set(row.event_id, [row.topic.slug]);
      }
      return { byEvent, names };
    },
  });
  const topicOptions = Array.from(topicData?.names.entries() ?? [])
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Only offer filters the Group's own dataset can actually satisfy.
  const availableKinds = Array.from(new Set(all.map((e) => e.kind).filter(Boolean)));
  const availableCategories = FIELD_OPTIONS.map((f) => ({
    ...f,
    count: all.filter((e) => e.creative_category && normalizeField(e.creative_category) === f.id)
      .length,
  })).filter((f) => f.count > 0);


  const matches = (e: EventLite) => {
    if (filters.category && (!e.creative_category || normalizeField(e.creative_category) !== filters.category)) return false;
    if (filters.kind && e.kind !== filters.kind) return false;
    if (!matchesAttendance(e.format, filters.format)) return false;
    if (filters.topic && !(topicData?.byEvent.get(e.id) ?? []).includes(filters.topic)) return false;
    const needle = filters.q.trim().toLowerCase();
    if (needle) {
      const hay =
        `${e.title} ${e.tagline ?? ""} ${e.venue_name ?? ""} ${e.external_organizer ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };

  const matched = all.filter(matches);
  const pinnedOrRecurring = matched
    .filter((e) => (e.pinned_at || e.is_recurring) && effectiveEndMs(e) >= now)
    .sort((a, b) => {
      if (!!b.pinned_at !== !!a.pinned_at) return b.pinned_at ? 1 : -1;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  const pinnedIds = new Set(pinnedOrRecurring.map((e) => e.id));
  const upcoming = matched.filter((e) => !pinnedIds.has(e.id) && effectiveEndMs(e) >= now);
  const past = matched
    .filter((e) => !pinnedIds.has(e.id) && effectiveEndMs(e) < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  const hasAnyMatch = pinnedOrRecurring.length + upcoming.length > 0;
  const hasFilters =
    !!filters.category ||
    !!filters.kind ||
    !!filters.topic ||
    filters.format !== "all" ||
    filters.q.trim().length > 0;

  const embedded = variant === "embedded";
  const cap = <T,>(list: T[]) => (embedded && limit ? list.slice(0, limit) : list);
  const pinnedShown = cap(pinnedOrRecurring);
  const upcomingShown = cap(upcoming);
  const moreCount =
    pinnedOrRecurring.length - pinnedShown.length + (upcoming.length - upcomingShown.length);

  const clearAll = () => {
    onFiltersChange({ category: null, kind: null, topic: null, format: "all", q: "" });
  };


  return (
    <div className={embedded ? "space-y-6" : "space-y-10"}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? (
          <Link
            to="/g/$slug/events"
            params={{ slug: group.slug }}
            className="text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            See all events
          </Link>
        ) : (
          <div>
            <h1 className="font-display text-2xl text-ink md:text-3xl">
              {directoryHeading(group)}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{directorySubheading(group)}</p>
          </div>
        )}
        {isAdmin && (
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft hover:bg-muted"
          >
            + Add event
          </Link>
        )}
      </header>

      {/* Shared sticky filter header — same primitive as /groups. */}
      {all.length > 0 && (
        <FilterHeader
          inset
          className={cn(
            "-mt-4",
            embedded && "top-[5.5rem] z-20 md:top-[7.25rem]",
          )}
        >
          <FilterSearch
            value={filters.q}
            onChange={(q) => onFiltersChange({ q })}
            label="Search events"
            placeholder="Search events, venues, organizers…"
          />

          <FilterControls>
            {availableCategories.length > 1 && (
              <FilterSelect
                label="Filter by medium"
                width="min-w-[11rem]"
                value={filters.category ?? "all"}
                onChange={(v) => onFiltersChange({ category: v === "all" ? null : v })}
              >
                <option value="all">All mediums</option>
                {availableCategories.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.count})
                  </option>
                ))}
              </FilterSelect>
            )}

            {availableKinds.length > 1 && (
              <FilterSelect
                label="Filter by event type"
                width="min-w-[11rem]"
                value={filters.kind ?? "all"}
                onChange={(v) => onFiltersChange({ kind: v === "all" ? null : v })}
              >
                <option value="all">All event types</option>
                {availableKinds.map((k) => (
                  <option key={k} value={k}>
                    {eventKindLabel(k)}
                  </option>
                ))}
              </FilterSelect>
            )}

            <FilterSelect
              label="Filter by attendance"
              width="min-w-[10rem]"
              value={filters.format}
              onChange={(v) => onFiltersChange({ format: v as AttendanceFilter })}
            >
              {ATTENDANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>

            {topicOptions.length > 0 ? (
              <FilterSelect
                label="Filter by topic"
                width="min-w-[10rem]"
                value={filters.topic ?? ""}
                onChange={(v) => onFiltersChange({ topic: v || null })}
              >
                <option value="">All topics</option>
                {topicOptions.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </FilterSelect>
            ) : null}

            {hasFilters ? <FilterClear onClick={clearAll} /> : null}
          </FilterControls>
        </FilterHeader>
      )}


      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

      {!isLoading && pinnedShown.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-ink">Pinned &amp; recurring</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedShown.map((e) => (
              <EventCardLite key={e.id} ev={e} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && upcomingShown.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-ink">Upcoming</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingShown.map((e) => (
              <EventCardLite key={e.id} ev={e} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && embedded && moreCount > 0 && (
        <Link
          to="/g/$slug/events"
          params={{ slug: group.slug }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft hover:bg-muted"
        >
          See all {pinnedOrRecurring.length + upcoming.length} events
        </Link>
      )}


      {!isLoading &&
        !hasAnyMatch &&
        (hasFilters ? (
          <div className="text-center text-sm text-ink-muted">
            No events match your filters.{" "}
            <button onClick={clearAll} className="underline hover:text-ink">
              Clear
            </button>
          </div>
        ) : isAdmin ? (
          <Link
            to="/admin/events"
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-soft transition hover:border-border-strong hover:bg-muted"
          >
            <span className="inline-flex items-center gap-2 font-medium text-ink">
              <Plus className="h-4 w-4" /> Add the first event to {group.name}
            </span>
            <span className="text-xs text-ink-muted">
              New events will appear here as they are added.
            </span>
          </Link>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
            The calendar is quiet for now. New events will appear here as they are added.
          </p>
        ))}

      {!isLoading && past.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">
            Past events ({past.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {past.map((e) => (
              <li key={e.id}>
                <Link
                  to="/g/$slug/e/$eventSlug"
                  params={{ slug: e.group_slug, eventSlug: e.slug }}
                  className="text-sm text-ink-soft hover:text-ink"
                >
                  · {e.title}{" "}
                  <span className="text-ink-muted">
                    — {new Date(e.starts_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}




export function EventCardLite({ ev }: { ev: EventLite }) {
  const starts = new Date(ev.starts_at);
  const isExternal = ev.source === "external" && !!ev.external_url;
  const isOnline = ev.format === "online" || ev.format === "hybrid";
  const locationLine = isOnline ? "Online" : (ev.venue_name ?? ev.venue_address ?? "TBA");
  const category = ev.creative_category ? { label: categoryLabel(ev.creative_category) } : null;
  const specialization = ev.subcategory ? subcategoryLabel(ev.subcategory) : null;

  // Canonical destination only — outbound links live on the event page.
  return (
    <Link
      to="/g/$slug/e/$eventSlug"
      params={{ slug: ev.group_slug, eventSlug: ev.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className={cn("relative h-32 w-full", ev.cover_url ? "bg-cover bg-center" : "bg-secondary")}
        style={ev.cover_url ? { backgroundImage: `url(${ev.cover_url})` } : undefined}
      >
        <div className="absolute left-3 top-3 rounded-xl bg-background/90 px-2 py-1 text-center shadow-soft">
          <div className="text-[9px] font-medium uppercase text-ink-muted">
            {starts.toLocaleDateString(undefined, { month: "short" })}
          </div>
          <div className="font-display text-base leading-none text-ink">{starts.getDate()}</div>
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {ev.pinned_at && (
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-ink shadow-soft">
              Pinned
            </span>
          )}
          {ev.is_recurring && (
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-soft">
              {ev.recurrence_label || "Recurring"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-display text-sm text-ink">{ev.title}</h3>
        <div className="text-[11px] text-ink-muted">
          {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {" · "}
          {locationLine}
        </div>
        {/* One quiet directory line: what kind of event, what creative world. */}
        <div className="text-[11px] text-ink-muted/80">
          {eventKindLabel(ev.kind)}
          {category ? ` · ${category.label}` : ""}
          {specialization ? ` · ${specialization}` : ""}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
          <span className="text-ink-muted">
            {isExternal
              ? `External${ev.external_organizer ? ` · ${ev.external_organizer}` : ""}`
              : `${ev.going_count} going${ev.capacity ? ` / ${ev.capacity}` : ""}`}
          </span>
          {isExternal ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
              View event ↗
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
