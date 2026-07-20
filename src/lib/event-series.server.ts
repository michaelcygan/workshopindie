/**
 * Rolling materializer for recurring event series.
 * Server-only: called by the admin `createEventSeries`, by the public
 * cron route `/api/public/events.materialize`, and after series edits.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SeriesRule = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Milliseconds in one horizon window (weeks). */
function horizonEndAt(weeks: number): Date {
  return new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
}

/** Advance a UTC instant by one step of the given rule. */
export function advanceInstant(iso: string, rule: SeriesRule): string {
  const d = new Date(iso);
  if (rule === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else if (rule === "BIWEEKLY") d.setUTCDate(d.getUTCDate() + 14);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

type SeriesRow = {
  id: string;
  series_key: string;
  group_id: string;
  recurrence_rule: SeriesRule;
  duration_minutes: number;
  template: Record<string, unknown>;
  horizon_weeks: number;
  next_occurrence_at: string;
  ends_on: string | null;
};

/**
 * Materialize any missing occurrences for a single series up to the horizon.
 * Returns the number of new rows inserted.
 */
export async function materializeSeries(
  admin: SupabaseClient<Database>,
  series: SeriesRow,
  createdBy: string | null,
): Promise<number> {
  const horizon = horizonEndAt(series.horizon_weeks);
  let cursor = series.next_occurrence_at;
  let inserted = 0;
  // Safety cap: never produce more than one horizon's worth in a single sweep.
  const maxSteps = series.horizon_weeks * 7 + 4;
  for (let step = 0; step < maxSteps; step += 1) {
    const startsAt = new Date(cursor);
    if (startsAt > horizon) break;
    if (series.ends_on && startsAt > new Date(`${series.ends_on}T23:59:59Z`)) break;
    const endsAt = new Date(startsAt.getTime() + series.duration_minutes * 60 * 1000);

    const row = {
      ...series.template,
      group_id: series.group_id,
      series_key: series.series_key,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      slug: "",
      created_by: createdBy,
      status: (series.template.status as string | undefined) ?? "scheduled",
    };
    // Unique index (series_key, starts_at) makes this idempotent.
    const { error } = await admin
      .from("group_events")
      .insert(row as never)
      .select("id")
      .single();
    if (error) {
      // 23505 = unique_violation — already materialized; skip.
      const code = (error as unknown as { code?: string }).code;
      if (code !== "23505") throw new Error(error.message);
    } else {
      inserted += 1;
    }
    cursor = advanceInstant(cursor, series.recurrence_rule);
  }
  // Persist the advanced cursor so the next sweep picks up where we left off.
  if (cursor !== series.next_occurrence_at) {
    const { error: upErr } = await admin
      .from("event_series")
      .update({ next_occurrence_at: cursor })
      .eq("id", series.id);
    if (upErr) throw new Error(upErr.message);
  }
  return inserted;
}

/** Sweep every active series that's due for a top-up. */
export async function materializeAllDueSeries(
  admin: SupabaseClient<Database>,
): Promise<{ series: number; inserted: number }> {
  const { data: rows, error } = await admin
    .from("event_series")
    .select("id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,created_by,canceled_at")
    .is("canceled_at", null)
    .limit(500);
  if (error) throw new Error(error.message);
  let inserted = 0;
  let touched = 0;
  for (const r of (rows ?? []) as unknown as (SeriesRow & { created_by: string | null })[]) {
    const n = await materializeSeries(admin, r, r.created_by);
    inserted += n;
    touched += 1;
  }
  return { series: touched, inserted };
}
