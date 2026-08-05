import { describe, expect, it } from "vitest";
import {
  collapseSeries,
  effectiveEndMs,
  isDiscoverable,
  DEFAULT_EVENT_DURATION_MS,
} from "@/lib/events/filters";

const iso = (ms: number) => new Date(ms).toISOString();
const now = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("effectiveEndMs", () => {
  it("uses the explicit end time", () => {
    expect(effectiveEndMs({ starts_at: iso(now), ends_at: iso(now + 5_000) })).toBe(now + 5_000);
  });

  it("falls back to a grace window when there is no end time", () => {
    expect(effectiveEndMs({ starts_at: iso(now), ends_at: null })).toBe(
      now + DEFAULT_EVENT_DURATION_MS,
    );
  });

  it("keeps a started event current until it ends", () => {
    const started = { starts_at: iso(now - 60_000), ends_at: iso(now + 60_000) };
    expect(effectiveEndMs(started)).toBeGreaterThan(now);
  });
});

describe("isDiscoverable", () => {
  const base = { status: "scheduled", published_at: iso(now), archived_at: null, deleted_at: null };

  it("accepts a published, live flyer", () => {
    expect(isDiscoverable(base)).toBe(true);
    expect(isDiscoverable({ ...base, status: "live" })).toBe(true);
  });

  it("hides drafts", () => {
    expect(isDiscoverable({ ...base, published_at: null })).toBe(false);
  });

  it("hides archived events", () => {
    expect(isDiscoverable({ ...base, archived_at: iso(now) })).toBe(false);
  });

  it("hides canceled and deleted events", () => {
    expect(isDiscoverable({ ...base, status: "canceled" })).toBe(false);
    expect(isDiscoverable({ ...base, deleted_at: iso(now) })).toBe(false);
  });
});

describe("collapseSeries", () => {
  it("keeps one card per recurring series, in list order", () => {
    const rows = [
      { id: "a", series_key: "weekly" },
      { id: "b", series_key: "weekly" },
      { id: "c", series_key: "monthly" },
      { id: "d", series_key: null },
      { id: "e", series_key: null },
    ];
    expect(collapseSeries(rows).map((r) => r.id)).toEqual(["a", "c", "d", "e"]);
  });

  it("leaves one-off events untouched", () => {
    const rows = [{ id: "a", series_key: null }, { id: "b", series_key: null }];
    expect(collapseSeries(rows)).toHaveLength(2);
  });
});
