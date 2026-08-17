import { describe, expect, it } from "vitest";
import {
  evaluateVenuePolicy,
  getWorkshopVenue,
  listWorkshopVenues,
  maxRsvps,
  publicVenueDetails,
} from "./workshop-venues";
import { reconcileVenue } from "@/lib/group-events-admin.functions";

describe("capacity + overflow", () => {
  it("treats a missing overflow as zero", () => {
    expect(maxRsvps(10, null)).toBe(10);
    expect(maxRsvps(10, 0)).toBe(10);
  });

  it("adds overflow to capacity", () => {
    expect(maxRsvps(10, 5)).toBe(15);
  });

  it("never produces a finite ceiling without a capacity", () => {
    expect(maxRsvps(null, 5)).toBeNull();
  });

  it("ignores a negative overflow rather than shrinking capacity", () => {
    expect(maxRsvps(10, -3)).toBe(10);
  });
});

describe("venue registry", () => {
  it("puts Off Color first and marks it as the Chicago home base", () => {
    const first = listWorkshopVenues()[0]!;
    expect(first.key).toBe("chi_off_color_mousetrap");
    expect(first.is_open_house_home_base).toBe(true);
  });

  it("has exactly the eight canonical Chicago venues", () => {
    expect(listWorkshopVenues()).toHaveLength(8);
  });

  it("never invents a group trigger for Off Color", () => {
    expect(getWorkshopVenue("chi_off_color_mousetrap")!.group_policy_trigger).toBeNull();
  });
});

describe("venue policy evaluation", () => {
  it("warns at Begyle once the calculated maximum reaches 15", () => {
    const r = evaluateVenuePolicy({ key: "chi_begyle_brewing", capacity: 10, overflow: 5 });
    expect(r.status).toBe("group_trigger_reached");
    expect(r.requiresReview).toBe(true);
    expect(r.maxRsvps).toBe(15);
  });

  it("stays eligible at Begyle below 15", () => {
    expect(
      evaluateVenuePolicy({ key: "chi_begyle_brewing", capacity: 10, overflow: 4 }).requiresReview,
    ).toBe(false);
  });

  it("warns at Half Acre at 10", () => {
    expect(
      evaluateVenuePolicy({ key: "chi_half_acre_balmoral", capacity: 8, overflow: 2 }).status,
    ).toBe("group_trigger_reached");
    expect(
      evaluateVenuePolicy({ key: "chi_half_acre_balmoral", capacity: 7, overflow: 2 })
        .requiresReview,
    ).toBe(false);
  });

  it("warns at Marz at 10", () => {
    expect(evaluateVenuePolicy({ key: "chi_marz_mothership", capacity: 10, overflow: 0 }).status).toBe(
      "group_trigger_reached",
    );
  });

  it("does not turn Cara Cara's optional reservation range into a hard block", () => {
    expect(
      evaluateVenuePolicy({ key: "chi_cara_cara_club", capacity: 15, overflow: 5 }).requiresReview,
    ).toBe(false);
  });

  it("does not turn District Brew Yards' optional gathering space into a hard block", () => {
    expect(
      evaluateVenuePolicy({ key: "chi_district_brew_yards_west_loop", capacity: 20, overflow: 5 })
        .requiresReview,
    ).toBe(false);
  });

  it("requires review at Still Life until its walk-in policy is verified", () => {
    const r = evaluateVenuePolicy({ key: "chi_solemn_oath_still_life", capacity: 6, overflow: 0 });
    expect(r.status).toBe("walk_in_unverified");
    expect(r.requiresReview).toBe(true);
  });

  it("clears review once an admin confirms the venue's own flow", () => {
    expect(
      evaluateVenuePolicy({
        key: "chi_begyle_brewing",
        capacity: 10,
        overflow: 5,
        confirmed: true,
      }).requiresReview,
    ).toBe(false);
  });

  it("leaves ordinary non-Workshop events untouched", () => {
    const r = evaluateVenuePolicy({ key: null, capacity: 40, overflow: 10 });
    expect(r.status).toBe("eligible");
    expect(r.reason).toBeNull();
  });
});

describe("public venue projection", () => {
  it("exposes only the approved public subset", () => {
    const pub = publicVenueDetails("chi_half_acre_balmoral")!;
    expect(Object.keys(pub).sort()).toEqual(
      [
        "address",
        "age_policy",
        "food_note",
        "indoor_outdoor",
        "neighborhood",
        "seating_note",
        "venue_name",
        "venue_type",
        "website",
        "wifi",
      ].sort(),
    );
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain("10");
    expect(serialized).not.toContain("workshop_venue");
    expect(serialized).not.toContain("verified");
  });

  it("returns nothing for an unknown key", () => {
    expect(publicVenueDetails(null)).toBeNull();
    expect(publicVenueDetails("nope")).toBeNull();
  });
});

describe("reconcileVenue", () => {
  it("keeps the canonical key when the snapshot still matches", () => {
    const v = getWorkshopVenue("chi_off_color_mousetrap")!;
    const { key } = reconcileVenue({
      workshop_venue_key: v.key,
      venue_name: v.venue_name,
      venue_address: v.address,
      capacity: 12,
      overflow: 3,
      status: "scheduled",
    });
    expect(key).toBe(v.key);
  });

  it("detaches the key when an admin edits the venue snapshot", () => {
    const { key } = reconcileVenue({
      workshop_venue_key: "chi_off_color_mousetrap",
      venue_name: "Some other bar",
      venue_address: "1 Elsewhere Ave",
      capacity: null,
      overflow: 0,
      status: "scheduled",
    });
    expect(key).toBeNull();
  });

  it("blocks publishing past a published group trigger", () => {
    expect(() =>
      reconcileVenue({
        workshop_venue_key: "chi_begyle_brewing",
        venue_name: "Begyle Brewing",
        venue_address: "1800 W Cuyler Ave, Chicago, IL 60613",
        capacity: 10,
        overflow: 5,
        status: "scheduled",
      }),
    ).toThrow(/group policy trigger/i);
  });

  it("lets a draft stay unblocked", () => {
    expect(() =>
      reconcileVenue({
        workshop_venue_key: "chi_begyle_brewing",
        venue_name: "Begyle Brewing",
        venue_address: "1800 W Cuyler Ave, Chicago, IL 60613",
        capacity: 10,
        overflow: 5,
        status: "draft",
      }),
    ).not.toThrow();
  });
});
