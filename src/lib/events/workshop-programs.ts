/**
 * Workshop Event Programs — Workshop-created automated Event programs.
 *
 * A "program" is not a new public object and not a calendar recurrence rule.
 * It is a small persistent configuration Workshop controls from Admin, whose
 * output is always an ordinary `group_events` row. The fixed
 * weekly/biweekly/monthly `event_series` engine is untouched: Open House is a
 * *program* whose occurrences rotate across venues and time windows.
 *
 * This module is client-safe: pure types plus the deterministic monthly
 * planner. All database work lives in `workshop-programs.server.ts`.
 *
 * Determinism is the whole point. The plan for a given month is a pure
 * function of (program key, year, month, configuration). Re-running the
 * materializer can never reshuffle an already-materialized occurrence.
 */

import { evaluateVenuePolicy, getWorkshopVenue } from "@/lib/events/workshop-venues";

export const OPEN_HOUSE_PROGRAM_KEY = "open_house_chicago";

export type ProgramVenueConfig = {
  enabled: boolean;
  capacity: number | null;
  overflow: number;
  /** Internal: venue may sit in the pool but never auto-publish. */
  needs_review: boolean;
  /** Local weekdays (0 = Sunday) this venue may be scheduled on. */
  weekdays: number[];
  min_age?: number | null;
};

export type ScheduleWindowKind = "evening" | "weekend_afternoon";

export type ScheduleWindow = {
  id: string;
  kind: ScheduleWindowKind;
  weekdays: number[];
  hour: number;
  minute: number;
};

export type ProgramRow = {
  id: string;
  key: string;
  program_type: string;
  name: string;
  group_id: string;
  active: boolean;
  timezone: string;
  events_per_month: number;
  target_future_occurrences: number;
  min_lead_days: number;
  duration_minutes: number;
  home_base_venue_key: string | null;
  venue_config: Record<string, ProgramVenueConfig>;
  schedule_windows: ScheduleWindow[];
  template: Record<string, string | number | boolean | null>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_materialized_at: string | null;
  last_error: string | null;
};

// ------------------------------------------------------------ determinism --

/** FNV-1a. Stable across runs and machines — never `Math.random()`. */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], r: () => number): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(r() * items.length)] ?? items[0] ?? null;
}

// ------------------------------------------------------------ eligibility --

export type VenueSkip = { venueKey: string; reason: string };

/**
 * Venues the program may publish to *unattended*. A venue stays in the pool
 * for admin visibility but is excluded here when it is inactive, flagged for
 * review, or when its configured capacity + overflow would reach the venue's
 * published group-policy trigger. Automation never confirms a venue policy.
 */
export function eligibleVenues(program: ProgramRow): {
  keys: string[];
  skipped: VenueSkip[];
} {
  const keys: string[] = [];
  const skipped: VenueSkip[] = [];
  for (const [key, cfg] of Object.entries(program.venue_config ?? {})) {
    if (!cfg?.enabled) {
      skipped.push({ venueKey: key, reason: "Disabled in the program configuration." });
      continue;
    }
    const venue = getWorkshopVenue(key);
    if (!venue || !venue.active) {
      skipped.push({ venueKey: key, reason: "Venue is no longer active in the registry." });
      continue;
    }
    if (cfg.needs_review) {
      skipped.push({
        venueKey: key,
        reason: `${venue.venue_name} needs review before auto-scheduling.`,
      });
      continue;
    }
    const policy = evaluateVenuePolicy({
      key,
      capacity: cfg.capacity ?? null,
      overflow: cfg.overflow ?? 0,
      confirmed: false,
    });
    if (policy.requiresReview) {
      skipped.push({ venueKey: key, reason: policy.reason ?? "Venue requires admin review." });
      continue;
    }
    keys.push(key);
  }
  keys.sort();
  return { keys, skipped };
}

// ---------------------------------------------------------------- planner --

export type PlannedOccurrence = {
  /** 1-based slot within the month. */
  slot: number;
  occurrenceKey: string;
  venueKey: string;
  /** Local wall-clock in the program timezone. */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  windowKind: ScheduleWindowKind;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Local weekday (0 = Sunday) for a wall-clock civil date. */
function civilWeekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/**
 * Deterministic plan for one calendar month.
 *
 * Rhythm: one home-base occurrence plus (events_per_month - 1) rotating ones,
 * spread across the month in week buckets, three evenings and one weekend
 * afternoon by default. The rotation offset advances by month so the pool
 * cycles before a venue repeats.
 */
export function planMonth(
  program: ProgramRow,
  year: number,
  month: number,
): { occurrences: PlannedOccurrence[]; skipped: VenueSkip[] } {
  const { keys: eligible, skipped } = eligibleVenues(program);
  if (eligible.length === 0) return { occurrences: [], skipped };

  const count = Math.max(1, program.events_per_month || 4);
  const home =
    program.home_base_venue_key && eligible.includes(program.home_base_venue_key)
      ? program.home_base_venue_key
      : null;
  const rotating = eligible.filter((k) => k !== home);

  const r = rng(seedFrom(program.key, year, month));
  const total = daysInMonth(year, month);
  const dim = total;

  // Week buckets keep the four occurrences spread rather than clustered.
  const buckets: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * dim) / count) + 1;
    const end = Math.floor(((i + 1) * dim) / count);
    buckets.push([start, end]);
  }

  // Home base sits in a stable-ish bucket; the weekend slot lands elsewhere.
  const homeSlot = home ? 1 % count : -1;
  const otherSlots = Array.from({ length: count }, (_, i) => i).filter((i) => i !== homeSlot);
  const weekendSlot = otherSlots.length > 0 ? (pick(otherSlots, r) ?? 0) : 0;

  const windows = (program.schedule_windows ?? []) as ScheduleWindow[];
  const rotOffset = rotating.length > 0 ? monthIndex(year, month) * (count - 1) : 0;

  const occurrences: PlannedOccurrence[] = [];
  let rotCursor = 0;
  const chosenDays: number[] = [];
  const usedCombos = new Set<string>();

  for (let slot = 0; slot < count; slot++) {
    const venueKey =
      slot === homeSlot
        ? home!
        : rotating.length > 0
          ? rotating[(rotOffset + rotCursor++) % rotating.length]!
          : (home ?? eligible[0]!);
    const cfg = program.venue_config[venueKey];
    const venueDays = cfg?.weekdays?.length ? cfg.weekdays : [0, 1, 2, 3, 4, 5, 6];
    const wantKind: ScheduleWindowKind = slot === weekendSlot ? "weekend_afternoon" : "evening";

    const [from, to] = buckets[slot]!;
    const candidates: { day: number; win: ScheduleWindow }[] = [];
    for (const win of windows) {
      if (win.kind !== wantKind) continue;
      for (let day = from; day <= to; day++) {
        const wd = civilWeekday(year, month, day);
        if (!win.weekdays.includes(wd)) continue;
        if (!venueDays.includes(wd)) continue;
        // Avoid two occurrences within a few days of each other.
        if (chosenDays.some((d) => Math.abs(d - day) < 4)) continue;
        // Avoid repeating the same weekday + time inside one month.
        if (usedCombos.has(`${wd}:${win.hour}:${win.minute}`)) continue;
        candidates.push({ day, win });
      }
    }

    const chosen = pick(candidates, r);
    if (!chosen) {
      // No sensible slot for this venue/window this month — skip it rather
      // than cramming or silently moving to a different venue.
      continue;
    }
    chosenDays.push(chosen.day);
    usedCombos.add(
      `${civilWeekday(year, month, chosen.day)}:${chosen.win.hour}:${chosen.win.minute}`,
    );
    occurrences.push({
      slot: slot + 1,
      occurrenceKey: occurrenceKeyFor(program.key, year, month, slot + 1),
      venueKey,
      year,
      month,
      day: chosen.day,
      hour: chosen.win.hour,
      minute: chosen.win.minute,
      windowKind: wantKind,
    });
  }

  occurrences.sort((a, b) => a.day - b.day);
  return { occurrences, skipped };
}

export function occurrenceKeyFor(
  programKey: string,
  year: number,
  month: number,
  slot: number,
): string {
  return `${programKey}:${year}-${String(month).padStart(2, "0")}:${String(slot).padStart(2, "0")}`;
}

/**
 * Minimum age for an occurrence: the program's venue configuration wins, then
 * the venue's own published age policy for late starts.
 */
export function occurrenceMinAge(
  venueKey: string,
  cfg: ProgramVenueConfig | undefined,
  localHour: number,
): number | null {
  if (cfg?.min_age != null) return cfg.min_age;
  const venue = getWorkshopVenue(venueKey);
  const policy = venue?.age_policy ?? "";
  if (/21\+\s*only/i.test(policy)) return 21;
  if (/21\+\s*after\s*6/i.test(policy) && localHour >= 18) return 21;
  return null;
}

export function windowKindLabel(kind: ScheduleWindowKind): string {
  return kind === "evening" ? "Evening" : "Weekend afternoon";
}
