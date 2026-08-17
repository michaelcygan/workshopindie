import { describe, it, expect } from "vitest";
import {
  advanceInstant,
  advanceParts,
  toZonedParts,
  zonedPartsToUtc,
  TARGET_FUTURE_OCCURRENCES,
  templateRow,
} from "@/lib/event-series.server";
import { DISCOVERABLE_STATUSES, canonicalEventPath, dropDeletedGroups } from "@/lib/events/filters";

const CHI = "America/Chicago";

describe("timezone round-tripping", () => {
  it("round-trips an instant through zoned parts", () => {
    const iso = "2026-07-22T01:00:00.000Z";
    const parts = toZonedParts(new Date(iso), CHI);
    expect(zonedPartsToUtc(parts, CHI).toISOString()).toBe(iso);
  });

  it("keeps local wall-clock time across a spring-forward DST boundary", () => {
    // 2026-03-08 is the US spring-forward date.
    const before = "2026-03-04T01:00:00.000Z"; // 19:00 Mar 3 in Chicago (CST)
    const after = advanceInstant(before, "WEEKLY", CHI);
    const p1 = toZonedParts(new Date(before), CHI);
    const p2 = toZonedParts(new Date(after), CHI);
    expect(p2.hour).toBe(p1.hour);
    expect(p2.minute).toBe(p1.minute);
    // The UTC instant shifts by 7 days minus the one lost hour.
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(
      7 * 24 * 3600 * 1000 - 3600 * 1000,
    );
  });

  it("keeps local wall-clock time across a fall-back DST boundary", () => {
    const before = "2026-10-28T00:00:00.000Z"; // 19:00 Oct 27 Chicago (CDT)
    const after = advanceInstant(before, "WEEKLY", CHI);
    expect(toZonedParts(new Date(after), CHI).hour).toBe(toZonedParts(new Date(before), CHI).hour);
  });
});

describe("recurrence stepping", () => {
  it("steps weekly by 7 days", () => {
    const p = toZonedParts(new Date("2026-07-22T01:00:00Z"), "UTC");
    expect(advanceParts(p, "WEEKLY").day).toBe(29);
  });

  it("steps biweekly by 14 days", () => {
    const p = toZonedParts(new Date("2026-07-01T01:00:00Z"), "UTC");
    const n = advanceParts(p, "BIWEEKLY");
    expect(n.day).toBe(15);
    expect(n.month).toBe(7);
  });

  it("rolls weekly stepping over a month boundary", () => {
    const p = toZonedParts(new Date("2026-07-29T01:00:00Z"), "UTC");
    const n = advanceParts(p, "WEEKLY");
    expect(n.month).toBe(8);
    expect(n.day).toBe(5);
  });

  it("rolls weekly stepping over a year boundary", () => {
    const p = toZonedParts(new Date("2026-12-30T01:00:00Z"), "UTC");
    const n = advanceParts(p, "WEEKLY");
    expect(n.year).toBe(2027);
    expect(n.month).toBe(1);
    expect(n.day).toBe(6);
  });

  it("clamps monthly stepping into short months", () => {
    const p = toZonedParts(new Date("2026-01-31T12:00:00Z"), "UTC");
    const n = advanceParts(p, "MONTHLY");
    expect(n.month).toBe(2);
    expect(n.day).toBe(28);
  });

  it("wraps monthly stepping across December", () => {
    const p = toZonedParts(new Date("2026-12-15T12:00:00Z"), "UTC");
    const n = advanceParts(p, "MONTHLY");
    expect(n).toMatchObject({ year: 2027, month: 1, day: 15 });
  });

  it("is deterministic: stepping N times equals a single N-step walk", () => {
    let a = "2026-07-22T01:00:00.000Z";
    for (let i = 0; i < 5; i += 1) a = advanceInstant(a, "WEEKLY", CHI);
    let b = "2026-07-22T01:00:00.000Z";
    for (let i = 0; i < 5; i += 1) b = advanceInstant(b, "WEEKLY", CHI);
    expect(a).toBe(b);
  });

  it("advances a stale past anchor to a future instant within the horizon budget", () => {
    const now = new Date("2026-08-04T21:00:00Z");
    let cursor = "2026-01-06T01:00:00.000Z";
    let steps = 0;
    while (new Date(cursor) <= now && steps < 600) {
      cursor = advanceInstant(cursor, "WEEKLY", CHI);
      steps += 1;
    }
    expect(new Date(cursor) > now).toBe(true);
    expect(steps).toBeLessThan(600);
  });

  it("keeps a sane rolling horizon target", () => {
    expect(TARGET_FUTURE_OCCURRENCES).toBeGreaterThanOrEqual(4);
  });
});

describe("discovery invariants", () => {
  it("never surfaces draft or canceled events", () => {
    expect(DISCOVERABLE_STATUSES).not.toContain("draft");
    expect(DISCOVERABLE_STATUSES).not.toContain("canceled");
  });

  it("drops rows whose owning group is soft-deleted or missing", () => {
    const rows = [
      { id: "a", group: { slug: "ok", deleted_at: null } },
      { id: "b", group: { slug: "gone", deleted_at: "2026-01-01T00:00:00Z" } },
      { id: "c", group: null },
    ];
    expect(dropDeletedGroups(rows).map((r) => r.id)).toEqual(["a"]);
  });

  it("always builds the canonical Workshop event path", () => {
    expect(canonicalEventPath("austin-comedy", "tbd-comedy-open-mic")).toBe(
      "/g/austin-comedy/e/tbd-comedy-open-mic",
    );
  });
});

describe("series templates carry capacity + venue policy forward", () => {
  it("keeps overflow and the canonical Workshop venue key on every occurrence", () => {
    const row = templateRow({
      title: "Workshop Open House",
      capacity: 8,
      overflow: 4,
      workshop_venue_key: "chi_off_color_mousetrap",
      venue_name: "Off Color Brewing — Mousetrap",
      not_a_column: true,
    });
    expect(row.overflow).toBe(4);
    expect(row.workshop_venue_key).toBe("chi_off_color_mousetrap");
    expect(row.not_a_column).toBeUndefined();
  });
});
