import { describe, expect, it } from "vitest";
import {
  eventStatusLabel,
  getEventLifecycle,
  getEventMoment,
  interactionClosesAt,
  isCheckInOpen,
  isDiscoverableNow,
  isParticipationOpen,
  isRsvpOpen,
} from "@/lib/events/lifecycle";

const H = 3600 * 1000;
const base = (over: Record<string, unknown> = {}) => ({
  status: "scheduled",
  published_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  starts_at: "2026-06-01T18:00:00.000Z",
  ends_at: "2026-06-01T22:00:00.000Z",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("event lifecycle", () => {
  it("treats an unpublished event as a draft", () => {
    expect(getEventLifecycle(base({ published_at: null, status: "draft" }))).toBe("draft");
  });

  it("treats a published, unfinished event as published", () => {
    expect(getEventLifecycle(base(), at("2026-06-01T19:00:00.000Z"))).toBe("published");
  });

  it("archives on time even before the sweep stamps the row", () => {
    expect(getEventLifecycle(base(), at("2026-06-02T23:00:00.000Z"))).toBe("archived");
    expect(getEventLifecycle(base(), at("2026-06-02T21:00:00.000Z"))).toBe("published");
  });

  it("respects an explicit early archive", () => {
    const ev = base({ archived_at: "2026-05-01T00:00:00.000Z" });
    expect(getEventLifecycle(ev, at("2026-05-02T00:00:00.000Z"))).toBe("archived");
  });

  it("keeps canceled distinct", () => {
    expect(getEventLifecycle(base({ status: "canceled" }))).toBe("canceled");
  });
});

describe("event moment", () => {
  it("walks upcoming → live → afterglow → archived", () => {
    expect(getEventMoment(base(), at("2026-06-01T10:00:00.000Z"))).toBe("upcoming");
    expect(getEventMoment(base(), at("2026-06-01T20:00:00.000Z"))).toBe("live");
    expect(getEventMoment(base(), at("2026-06-02T10:00:00.000Z"))).toBe("afterglow");
    expect(getEventMoment(base(), at("2026-06-03T10:00:00.000Z"))).toBe("archived");
  });
});

describe("windows", () => {
  it("closes participation exactly 24h after the end", () => {
    const closes = interactionClosesAt(base())!;
    expect(new Date(closes).toISOString()).toBe("2026-06-02T22:00:00.000Z");
    expect(isParticipationOpen(base(), new Date(closes - 1))).toBe(true);
    expect(isParticipationOpen(base(), new Date(closes))).toBe(false);
  });

  it("falls back to a 4h duration with no end time", () => {
    const ev = base({ ends_at: null });
    expect(new Date(interactionClosesAt(ev)!).toISOString()).toBe("2026-06-02T22:00:00.000Z");
  });

  it("keeps RSVP open until the event ends", () => {
    expect(isRsvpOpen(base(), at("2026-06-01T21:59:00.000Z"))).toBe(true);
    expect(isRsvpOpen(base(), at("2026-06-01T22:01:00.000Z"))).toBe(false);
  });

  it("only allows check-in while the event runs", () => {
    expect(isCheckInOpen(base(), at("2026-06-01T17:59:00.000Z"))).toBe(false);
    expect(isCheckInOpen(base(), at("2026-06-01T18:01:00.000Z"))).toBe(true);
    expect(isCheckInOpen(base(), at("2026-06-01T22:01:00.000Z"))).toBe(false);
  });

  it("never opens participation on a draft or canceled event", () => {
    expect(isParticipationOpen(base({ published_at: null }), at("2026-06-01T20:00:00.000Z"))).toBe(
      false,
    );
    expect(isParticipationOpen(base({ status: "canceled" }), at("2026-06-01T20:00:00.000Z"))).toBe(
      false,
    );
  });
});

describe("discovery", () => {
  it("keeps a running event discoverable and drops it at the end", () => {
    expect(isDiscoverableNow(base(), at("2026-06-01T20:00:00.000Z"))).toBe(true);
    expect(isDiscoverableNow(base(), at("2026-06-01T22:00:00.000Z"))).toBe(false);
  });

  it("hides drafts and deleted events", () => {
    expect(isDiscoverableNow(base({ published_at: null }), at("2026-06-01T10:00:00.000Z"))).toBe(
      false,
    );
    expect(
      isDiscoverableNow(
        base({ deleted_at: "2026-01-02T00:00:00.000Z" }),
        at("2026-06-01T10:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("labels", () => {
  it("uses calm, human status copy", () => {
    expect(eventStatusLabel(base(), at("2026-05-01T00:00:00.000Z"))).toBe("Upcoming");
    expect(eventStatusLabel(base(), at("2026-06-01T20:00:00.000Z"))).toBe("Happening now");
    expect(
      eventStatusLabel(base(), new Date(new Date("2026-06-01T22:00:00.000Z").getTime() + H)),
    ).toBe("Posting open for 24 hours");
    expect(eventStatusLabel(base(), at("2026-06-05T00:00:00.000Z"))).toBe("Archived");
    expect(eventStatusLabel(base({ status: "canceled" }))).toBe("Canceled");
  });
});
