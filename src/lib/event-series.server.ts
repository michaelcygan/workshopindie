/**
 * Rolling materializer for recurring event series.
 *
 * Server-only: called by the admin `createEventSeries`, by the cron route
 * `/api/public/events/materialize`, and after series edits.
 *
 * Invariants this module guarantees:
 *  - One `group_events` row equals one dated occurrence.
 *  - The series always keeps TARGET_FUTURE_OCCURRENCES genuinely future rows.
 *  - Past anchors are advanced before the horizon is counted; skipping a past
 *    date never consumes the "needed" budget.
 *  - Occurrences keep their intended local wall-clock time in the series
 *    IANA timezone (correct across DST changes).
 *  - Inserts are idempotent under the unique (series_key, starts_at) index.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SeriesRule = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Target number of future occurrences kept materialized per series. */
export const TARGET_FUTURE_OCCURRENCES = 8;

// ---------------------------------------------------------------- timezone --

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Offset (ms) between the given instant's wall clock in `tz` and UTC. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - instant.getTime();
}

/** Break an instant into wall-clock parts in the given timezone. */
export function toZonedParts(instant: Date, timeZone: string): LocalParts {
  const shifted = new Date(instant.getTime() + tzOffsetMs(instant, timeZone));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** Convert wall-clock parts in a timezone back to a UTC instant. */
export function zonedPartsToUtc(parts: LocalParts, timeZone: string): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let ts = naive - tzOffsetMs(new Date(naive), timeZone);
  // One correction pass settles DST boundaries.
  ts = naive - tzOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Advance wall-clock parts by one step of the rule (local time preserved). */
export function advanceParts(parts: LocalParts, rule: SeriesRule): LocalParts {
  if (rule === "MONTHLY") {
    let year = parts.year;
    let month = parts.month + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return { ...parts, year, month, day: Math.min(parts.day, daysInMonth(year, month)) };
  }
  const step = rule === "BIWEEKLY" ? 14 : 7;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + step));
  return { ...parts, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Advance a UTC instant by one step of the rule, honoring the series timezone. */
export function advanceInstant(iso: string, rule: SeriesRule, timeZone = "UTC"): string {
  const parts = toZonedParts(new Date(iso), timeZone);
  return zonedPartsToUtc(advanceParts(parts, rule), timeZone).toISOString();
}

// ------------------------------------------------------------------ series --

export type SeriesRow = {
  id: string;
  series_key: string;
  group_id: string;
  recurrence_rule: SeriesRule;
  duration_minutes: number;
  template: Record<string, unknown>;
  horizon_weeks: number;
  next_occurrence_at: string;
  ends_on: string | null;
  timezone?: string | null;
  start_time_local?: string | null;
  extra_group_ids?: string[] | null;
};

/**
 * Columns the materializer is allowed to copy from a series template into a
 * `group_events` row. Anything else in the template (legacy keys, UI-only
 * flags) is ignored so an insert can never fail on an unknown column.
 */
const TEMPLATE_COLUMNS = [
  "title",
  "tagline",
  "description",
  "kind",
  "creative_category",
  "format",
  "cover_url",
  "photo_credit_name",
  "photo_credit_url",
  "accent_color",
  "timezone",
  "venue_name",
  "venue_address",
  "venue_city_id",
  "venue_lat",
  "venue_lng",
  "online_url",
  "capacity",
  // Overflow and the canonical venue key must survive into every occurrence.
  "overflow",
  "workshop_venue_key",
  "waitlist_enabled",
  "visibility",
  "rsvp_mode",
  "is_official",
  "lineup_capacity",
  "source",
  "external_url",
  "external_organizer",
  "is_recurring",
  "recurrence_label",
  "status",
] as const;

function templateRow(template: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TEMPLATE_COLUMNS) {
    if (template[key] !== undefined) out[key] = template[key];
  }
  out.is_recurring = true;
  return out;
}

/**
 * Materialize occurrences for a single series until at least
 * TARGET_FUTURE_OCCURRENCES future, non-canceled rows exist.
 * Returns the number of new rows inserted.
 */
export async function materializeSeries(
  admin: SupabaseClient<Database>,
  series: SeriesRow,
  createdBy: string | null,
): Promise<number> {
  const now = new Date();
  const nowIso = now.toISOString();
  const tz = series.timezone || (series.template.timezone as string | undefined) || "UTC";

  const { count: existingCount, error: countErr } = await admin
    .from("group_events")
    .select("id", { count: "exact", head: true })
    .eq("series_key", series.series_key)
    .gt("starts_at", nowIso)
    .is("deleted_at", null)
    .neq("status", "canceled");
  if (countErr) throw new Error(countErr.message);

  let needed = Math.max(0, TARGET_FUTURE_OCCURRENCES - (existingCount ?? 0));

  // Always advance the stored cursor past "now" first, so an old anchor never
  // eats the horizon budget with past dates.
  let cursorParts = toZonedParts(new Date(series.next_occurrence_at), tz);
  if (series.start_time_local) {
    const [h, m, s] = series.start_time_local.split(":").map((n) => Number(n) || 0);
    cursorParts = { ...cursorParts, hour: h ?? 0, minute: m ?? 0, second: s ?? 0 };
  }
  const endsOn = series.ends_on ? new Date(`${series.ends_on}T23:59:59Z`) : null;

  let guard = 0;
  while (zonedPartsToUtc(cursorParts, tz) <= now && guard < 600) {
    cursorParts = advanceParts(cursorParts, series.recurrence_rule);
    guard += 1;
  }

  const extraGroupIds = (series.extra_group_ids ?? []).filter((id) => id && id !== series.group_id);
  const base = templateRow(series.template);
  let inserted = 0;
  const maxSteps = TARGET_FUTURE_OCCURRENCES * 3 + 6;

  for (let step = 0; step < maxSteps && needed > 0; step += 1) {
    const startsAt = zonedPartsToUtc(cursorParts, tz);
    if (endsOn && startsAt > endsOn) break;
    const endsAt = new Date(startsAt.getTime() + series.duration_minutes * 60 * 1000);

    const occurrenceStatus = (base.status as string | undefined) ?? "scheduled";
    const row = {
      ...base,
      group_id: series.group_id,
      series_key: series.series_key,
      timezone: tz,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      slug: "",
      created_by: createdBy,
      status: occurrenceStatus,
      // A published series produces published occurrences; a draft series
      // produces private drafts. Archival is never inherited.
      published_at: occurrenceStatus === "draft" ? null : new Date().toISOString(),
      archived_at: null,
    };

    // Unique index (series_key, starts_at) makes this idempotent.
    const { data: insertedRow, error } = await admin
      .from("group_events")
      .insert(row as never)
      .select("id")
      .single();
    if (error) {
      const code = (error as unknown as { code?: string }).code;
      if (code !== "23505") throw new Error(error.message);
      // Duplicate: that date already exists, so it was already counted.
    } else {
      inserted += 1;
      needed -= 1;
      if (extraGroupIds.length > 0 && insertedRow) {
        await admin.from("event_groups").upsert(
          extraGroupIds.map((gid) => ({ event_id: insertedRow.id as string, group_id: gid })),
          { onConflict: "event_id,group_id", ignoreDuplicates: true },
        );
      }
    }
    cursorParts = advanceParts(cursorParts, series.recurrence_rule);
  }

  const nextIso = zonedPartsToUtc(cursorParts, tz).toISOString();
  await admin
    .from("event_series")
    .update({
      next_occurrence_at: nextIso,
      last_materialized_at: nowIso,
      last_error: null,
    } as never)
    .eq("id", series.id);

  await applySeriesPin(admin, series);
  return inserted;
}

/**
 * Pin intent lives on the series (`template.__pin`). Only the nearest eligible
 * future occurrence carries `pinned_at`; a pin never resurrects a past date.
 */
async function applySeriesPin(admin: SupabaseClient<Database>, series: SeriesRow): Promise<void> {
  if (series.template.__pin !== true) return;
  const nowIso = new Date().toISOString();
  const { data: next } = await admin
    .from("group_events")
    .select("id")
    .eq("series_key", series.series_key)
    .is("deleted_at", null)
    .neq("status", "canceled")
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return;
  await admin
    .from("group_events")
    .update({ pinned_at: null } as never)
    .eq("series_key", series.series_key)
    .neq("id", next.id);
  await admin
    .from("group_events")
    .update({ pinned_at: nowIso } as never)
    .eq("id", next.id)
    .is("pinned_at", null);
}

const SERIES_SELECT =
  "id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,created_by,canceled_at,timezone,start_time_local,extra_group_ids";

/** Sweep every active series that's due for a top-up. */
export async function materializeAllDueSeries(
  admin: SupabaseClient<Database>,
): Promise<{ series: number; inserted: number; errors: number }> {
  const { data: rows, error } = await admin
    .from("event_series")
    .select(SERIES_SELECT)
    .is("canceled_at", null)
    .limit(500);
  if (error) throw new Error(error.message);
  let inserted = 0;
  let touched = 0;
  let errors = 0;
  for (const r of (rows ?? []) as unknown as (SeriesRow & { created_by: string | null })[]) {
    try {
      inserted += await materializeSeries(admin, r, r.created_by);
      touched += 1;
    } catch (e) {
      errors += 1;
      await admin
        .from("event_series")
        .update({ last_error: (e as Error).message.slice(0, 500) } as never)
        .eq("id", r.id);
    }
  }
  return { series: touched, inserted, errors };
}

/** Admin health signal: series that are stalled, empty, or erroring. */
export async function seriesHealth(admin: SupabaseClient<Database>) {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("event_series")
    .select(`${SERIES_SELECT},created_at`)
    .is("canceled_at", null)
    .limit(500);
  if (error) throw new Error(error.message);
  const out: {
    id: string;
    series_key: string;
    group_id: string;
    future_count: number;
    last_materialized_at: string | null;
    last_error: string | null;
    overdue: boolean;
  }[] = [];
  for (const r of (rows ?? []) as unknown as (SeriesRow & {
    last_materialized_at?: string | null;
    last_error?: string | null;
  })[]) {
    const { count } = await admin
      .from("group_events")
      .select("id", { count: "exact", head: true })
      .eq("series_key", r.series_key)
      .is("deleted_at", null)
      .neq("status", "canceled")
      .gt("starts_at", nowIso);
    const last = r.last_materialized_at ?? null;
    const overdue = !last || Date.now() - new Date(last).getTime() > 36 * 3600 * 1000;
    if ((count ?? 0) === 0 || overdue || r.last_error) {
      out.push({
        id: r.id,
        series_key: r.series_key,
        group_id: r.group_id,
        future_count: count ?? 0,
        last_materialized_at: last,
        last_error: r.last_error ?? null,
        overdue,
      });
    }
  }
  return out;
}
