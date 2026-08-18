/**
 * Workshop Writing Co-working — planner behaviour.
 *
 * The guarantees under test are the ones automation depends on: the daypart
 * cycle comes from a stable ordinal (not run count), reruns produce identical
 * plans, venues are only used for dayparts they were reviewed for, and
 * review-required venues never enter the automatic rotation.
 */
import { describe, expect, it } from "vitest";
import {
  DAYPART_CYCLE,
  daypartForOrdinal,
  daypartVenues,
  occurrenceOrdinal,
  planMonth,
  type ProgramRow,
} from "@/lib/events/workshop-programs";
import {
  WRITING_COWORKING_TAGLINE,
  isWritingSession,
  writingCoworkingTitle,
} from "@/lib/events/coworking";
import { coworkingVenueMeta } from "@/lib/events/workshop-venues";

const venue = (extra: Partial<Record<string, unknown>> = {}) => ({
  enabled: true,
  capacity: 6,
  overflow: 2,
  needs_review: false,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  ...extra,
});

const program: ProgramRow = {
  id: "p1",
  key: "writing_coworking",
  program_type: "writing_coworking",
  name: "Workshop Writing Co-working",
  group_id: "g1",
  active: true,
  timezone: "America/Chicago",
  events_per_month: 4,
  target_future_occurrences: 8,
  min_lead_days: 7,
  duration_minutes: 180,
  home_base_venue_key: null,
  venue_config: {
    chi_begyle_brewing: venue(),
    chi_long_room: venue(),
    chi_off_color_mousetrap: venue(),
    chi_half_acre_balmoral: venue(),
    chi_marz_mothership: venue(),
    chi_waterfront_cafe: venue(),
    chi_solemn_oath_still_life: venue({ needs_review: true }),
  } as ProgramRow["venue_config"],
  schedule_windows: [],
  template: {},
  created_by: null,
  created_at: "",
  updated_at: "",
  last_materialized_at: null,
  last_error: null,
};

describe("daypart rotation", () => {
  it("cycles Morning → Afternoon → Evening from a stable ordinal", () => {
    expect(DAYPART_CYCLE).toEqual(["morning", "afternoon", "evening"]);
    const cycle = [0, 1, 2, 3, 4, 5].map(daypartForOrdinal);
    expect(cycle).toEqual([
      "morning",
      "afternoon",
      "evening",
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("continues the cycle across month boundaries", () => {
    const a = occurrenceOrdinal(2026, 9, 3, 4); // last slot of September
    const b = occurrenceOrdinal(2026, 10, 0, 4); // first slot of October
    expect(b).toBe(a + 1);
  });

  it("does not depend on how many times the planner ran", () => {
    const first = planMonth(program, 2026, 9).occurrences;
    const second = planMonth(program, 2026, 9).occurrences;
    const third = planMonth(program, 2026, 9).occurrences;
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("plans occurrences whose dayparts follow the cycle by slot", () => {
    const occ = planMonth(program, 2026, 9).occurrences;
    expect(occ.length).toBeGreaterThan(0);
    for (const o of occ) {
      expect(o.daypart).toBe(daypartForOrdinal(occurrenceOrdinal(2026, 9, o.slot - 1, 4)));
    }
  });
});

describe("venue selection", () => {
  it("only uses venues reviewed for the slot's daypart", () => {
    const occ = planMonth(program, 2026, 9).occurrences;
    for (const o of occ) {
      const meta = coworkingVenueMeta(o.venueKey);
      expect(meta).not.toBeNull();
      expect(meta!.dayparts).toContain(o.daypart!);
    }
  });

  it("excludes review-required venues from every daypart pool", () => {
    for (const d of DAYPART_CYCLE) {
      expect(daypartVenues(program, d)).not.toContain("chi_solemn_oath_still_life");
    }
  });

  it("never schedules the Obama Presidential Center Café", () => {
    const occ = planMonth(program, 2026, 9).occurrences;
    expect(occ.some((o) => o.venueKey.includes("obama"))).toBe(false);
  });

  it("produces unique occurrence keys per slot", () => {
    const keys = planMonth(program, 2026, 9).occurrences.map((o) => o.occurrenceKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("writing payload", () => {
  it("recognises writing-only sessions", () => {
    expect(isWritingSession(["writing"])).toBe(true);
    expect(isWritingSession(["writing", "sketching"])).toBe(false);
    expect(isWritingSession([])).toBe(false);
    expect(isWritingSession(null)).toBe(false);
  });

  it("titles occurrences by daypart and venue", () => {
    expect(writingCoworkingTitle("Begyle Brewing", "morning")).toBe(
      "Workshop Writing Co-working · Morning at Begyle Brewing",
    );
  });

  it("keeps the tagline writing-specific", () => {
    expect(WRITING_COWORKING_TAGLINE).toMatch(/write/i);
    expect(WRITING_COWORKING_TAGLINE).not.toMatch(/paint|craft|sketch/i);
  });
});
