/**
 * Materializer for Workshop Event Programs.
 *
 * Server-only. Called by the cron route `/api/public/events/materialize` and
 * by the admin "Top up now" action.
 *
 * Invariants:
 *  - Every occurrence is an ordinary `group_events` row.
 *  - `program_occurrence_key` is unique, so a rerun inserts nothing twice and
 *    never reshuffles or recreates an existing (or intentionally canceled)
 *    slot.
 *  - Automation never sets `venue_policy_confirmed`; a venue needing review is
 *    skipped with a recorded reason instead.
 *  - One bad venue never fails a run.
 *  - Background top-ups are quiet: no "new event" notification fan-out.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { zonedPartsToUtc } from "@/lib/event-series.server";
import { getWorkshopVenue, venueImageUrl } from "@/lib/events/workshop-venues";
import { reconcileVenue } from "@/lib/events/venue-reconcile";
import {
  occurrenceMinAge,
  planMonth,
  type ProgramRow,
  type PlannedOccurrence,
} from "@/lib/events/workshop-programs";

const PROGRAM_SELECT = "*";

/** How far ahead the planner is willing to look while filling the horizon. */
const MAX_MONTHS_AHEAD = 8;

export type ProgramSweepResult = {
  programs: number;
  inserted: number;
  skipped: number;
  errors: number;
};

function toProgram(row: Record<string, unknown>): ProgramRow {
  return {
    ...(row as unknown as ProgramRow),
    venue_config: (row.venue_config ?? {}) as ProgramRow["venue_config"],
    schedule_windows: (row.schedule_windows ?? []) as ProgramRow["schedule_windows"],
    template: (row.template ?? {}) as ProgramRow["template"],
  };
}

/**
 * Events require an author. A program's `created_by` is preferred; otherwise
 * fall back to a Workshop admin so automation always has a real owner.
 */
async function programAuthor(
  admin: SupabaseClient<Database>,
  program: ProgramRow,
): Promise<string> {
  if (program.created_by) return program.created_by;
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const id = data?.user_id as string | undefined;
  if (!id) throw new Error("No Workshop admin available to own automated events.");
  return id;
}

async function groupCityId(
  admin: SupabaseClient<Database>,
  groupId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("groups")
    .select("kind,city_id")
    .eq("id", groupId)
    .maybeSingle();
  return data?.kind === "city" ? ((data.city_id as string | null) ?? null) : null;
}

/**
 * Fill a single program's future horizon. Returns counters; per-occurrence
 * failures are isolated and reported as skips.
 */
export async function materializeProgram(
  admin: SupabaseClient<Database>,
  program: ProgramRow,
): Promise<{ inserted: number; skipped: number; reasons: string[] }> {
  const now = new Date();
  const nowIso = now.toISOString();
  const tz = program.timezone || "UTC";
  const target = program.target_future_occurrences || 8;
  const leadMs = Math.max(0, program.min_lead_days ?? 7) * 24 * 3600 * 1000;
  const earliest = new Date(now.getTime() + leadMs);

  const { count: futureCount } = await admin
    .from("group_events")
    .select("id", { count: "exact", head: true })
    .eq("workshop_event_program_id", program.id)
    .gt("starts_at", nowIso)
    .is("deleted_at", null)
    .neq("status", "canceled");

  let needed = Math.max(0, target - (futureCount ?? 0));
  if (needed === 0) return { inserted: 0, skipped: 0, reasons: [] };

  // Every key this program has ever produced, including canceled ones: a slot
  // that exists is done, whatever its current state.
  const { data: existingRows } = await admin
    .from("group_events")
    .select("program_occurrence_key")
    .eq("workshop_event_program_id", program.id)
    .not("program_occurrence_key", "is", null)
    .limit(2000);
  const existing = new Set(
    ((existingRows ?? []) as { program_occurrence_key: string | null }[])
      .map((r) => r.program_occurrence_key)
      .filter((k): k is string => Boolean(k)),
  );

  const cityId = await groupCityId(admin, program.group_id);
  const author = await programAuthor(admin, program);
  const base = program.template ?? {};

  let inserted = 0;
  let skipped = 0;
  const reasons: string[] = [];

  const cursor = new Date(now);
  for (let m = 0; m < MAX_MONTHS_AHEAD && needed > 0; m += 1) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);

    const { occurrences, skipped: venueSkips } = planMonth(program, year, month);
    for (const s of venueSkips) if (!reasons.includes(s.reason)) reasons.push(s.reason);

    for (const occ of occurrences) {
      if (needed <= 0) break;
      if (existing.has(occ.occurrenceKey)) continue;

      const startsAt = zonedPartsToUtc(
        {
          year: occ.year,
          month: occ.month,
          day: occ.day,
          hour: occ.hour,
          minute: occ.minute,
          second: 0,
        },
        tz,
      );
      // No backfilling, and never publish inside the lead-time window.
      if (startsAt < earliest) continue;

      try {
        await insertOccurrence(admin, program, occ, startsAt, cityId, base, author);
        inserted += 1;
        needed -= 1;
        existing.add(occ.occurrenceKey);
      } catch (e) {
        const msg = (e as Error).message;
        skipped += 1;
        if (!reasons.includes(msg)) reasons.push(msg);
      }
    }
  }

  return { inserted, skipped, reasons };
}

async function insertOccurrence(
  admin: SupabaseClient<Database>,
  program: ProgramRow,
  occ: PlannedOccurrence,
  startsAt: Date,
  cityId: string | null,
  base: ProgramRow["template"],
  author: string,
): Promise<void> {
  const venue = getWorkshopVenue(occ.venueKey);
  if (!venue) throw new Error(`Unknown venue "${occ.venueKey}".`);
  const cfg = program.venue_config[occ.venueKey];
  const capacity = cfg?.capacity ?? null;
  const overflow = cfg?.overflow ?? 0;

  // Same reconciliation + publish gate as manual creation. This throws when a
  // policy would need review, which the caller records as a skip.
  const { key } = reconcileVenue({
    workshop_venue_key: occ.venueKey,
    venue_name: venue.venue_name,
    venue_address: venue.address,
    capacity,
    overflow,
    venue_policy_confirmed: false,
    status: "scheduled",
  });

  const endsAt = new Date(startsAt.getTime() + (program.duration_minutes || 150) * 60 * 1000);
  const nowIso = new Date().toISOString();

  const row = {
    ...base,
    group_id: program.group_id,
    slug: "",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    timezone: program.timezone,
    format: (base.format as string) ?? "in_person",
    venue_name: venue.venue_name,
    venue_address: venue.address,
    venue_city_id: cityId,
    venue_lat: venue.lat ?? null,
    venue_lng: venue.lng ?? null,
    workshop_venue_key: key,
    capacity,
    overflow,
    min_age: occurrenceMinAge(occ.venueKey, cfg, occ.hour),
    daypart: occ.windowKind === "evening" ? "evening" : "afternoon",
    status: "scheduled",
    published_at: nowIso,
    archived_at: null,
    is_recurring: false,
    created_by: author,
    workshop_event_program_id: program.id,
    program_occurrence_key: occ.occurrenceKey,
  };

  const { error } = await admin.from("group_events").insert(row as never);
  if (error) {
    const code = (error as unknown as { code?: string }).code;
    if (code === "23505") return; // Slot already exists — idempotent.
    throw new Error(error.message);
  }
}

/** Sweep every active program. Never throws for a single bad program. */
export async function materializeAllPrograms(
  admin: SupabaseClient<Database>,
): Promise<ProgramSweepResult> {
  const { data: rows, error } = await admin
    .from("workshop_event_programs")
    .select(PROGRAM_SELECT)
    .eq("active", true)
    .limit(100);
  if (error) throw new Error(error.message);

  let programs = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const raw of (rows ?? []) as unknown as Record<string, unknown>[]) {
    const program = toProgram(raw);
    try {
      const res = await materializeProgram(admin, program);
      inserted += res.inserted;
      skipped += res.skipped;
      programs += 1;
      await admin
        .from("workshop_event_programs")
        .update({
          last_materialized_at: new Date().toISOString(),
          last_error: res.reasons.length > 0 ? res.reasons.join(" · ").slice(0, 800) : null,
        } as never)
        .eq("id", program.id);
    } catch (e) {
      errors += 1;
      await admin
        .from("workshop_event_programs")
        .update({ last_error: (e as Error).message.slice(0, 800) } as never)
        .eq("id", program.id);
    }
  }

  return { programs, inserted, skipped, errors };
}
