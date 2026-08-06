/**
 * Workshop analytics — canonical metric definitions.
 *
 * This file is the single source of truth for what every admin number means.
 * If a metric appears on more than one page, it must be computed once in SQL
 * (see the vw_* views below) and described once here. Do not redefine any of
 * these in a React component.
 *
 * SQL layer:
 *   vw_countable_profiles      — every member that counts toward analytics
 *   vw_user_activity_day       — the activity spine (member x day x surface)
 *   vw_dau_daily               — true daily actives, derived from the spine
 *   vw_user_activation         — first qualifying action per member
 *   vw_weekly_active_creators  — Weekly Active Creators by week
 *   vw_kpi_periods             — current vs prior 7d/30d for every headline
 *   vw_membership_growth       — daily signups + cumulative members
 *   vw_retention_headline      — D1 / D7 / D30 with real denominators
 *   vw_cohort_retention_weekly — weekly signup cohorts x weeks since signup
 *   vw_surface_30d             — engagement by product surface, 30d
 *   vw_geo_city_stats          — city market table
 *   vw_geo_country_stats       — country roll-up
 *   vw_revenue_now             — subscription snapshot
 */

/** Surfaces recorded in the activity spine. */
export const SURFACES = [
  "works",
  "collabs",
  "collab_applications",
  "blog",
  "events",
  "event_rsvps",
  "group_posts",
  "group_joins",
  "lounge_messages",
  "lounge_audio",
  "comments",
  "follows",
  "presence",
] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<string, string> = {
  works: "Works published",
  collabs: "Collabs posted",
  collab_applications: "Collab applications",
  blog: "Blog posts",
  events: "Events created",
  event_rsvps: "Event RSVPs",
  group_posts: "Group posts",
  group_joins: "Group joins",
  lounge_messages: "Lounge chat",
  lounge_audio: "Lounge audio",
  comments: "Comments",
  follows: "Follows",
  presence: "Presence (passive)",
};

/**
 * Qualifying creative actions. Everything except `presence` counts toward
 * Weekly Active Creators and Activation. Passive presence (being in a room,
 * page loads, scrolling) never does.
 */
export const CREATIVE_SURFACES = SURFACES.filter((s) => s !== "presence");

/** Workshop Plus list price. Subscriptions do not store an amount. */
export const PLUS_MONTHLY_PRICE_USD = 4.99;

/** Below this denominator, always show the underlying counts next to a %. */
export const SMALL_SAMPLE_THRESHOLD = 100;

/** Below this denominator a percentage is not meaningful at all. */
export const MIN_SAMPLE_FOR_PERCENT = 5;

/** Minimum members before a place can appear in "Emerging places". */
export const EMERGING_MIN_MEMBERS = 5;

export type MetricDefinition = { term: string; definition: string };

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  members_total: {
    term: "Total Members",
    definition:
      "Every registered profile that is not deleted and not flagged as excluded from analytics (test, system and internal accounts).",
  },
  signup: {
    term: "Signup",
    definition: "A countable member profile created during the period.",
  },
  dau: {
    term: "DAU",
    definition: "Countable members with at least one recorded action today (UTC).",
  },
  wau: {
    term: "WAU",
    definition: "Countable members with at least one recorded action in the trailing 7 days.",
  },
  mau: {
    term: "MAU",
    definition: "Countable members with at least one recorded action in the trailing 30 days.",
  },
  wac: {
    term: "Weekly Active Creators",
    definition:
      "Countable members who completed at least one qualifying creative or network action in the trailing 7 days: publishing a work, posting or applying to a Collab, publishing a blog post, creating an event, RSVPing, posting in a group, joining a group, Lounge chat or audio, commenting, or following. Passive browsing never qualifies.",
  },
  onboarded: {
    term: "Onboarded",
    definition: "Member completed required onboarding (profiles.onboarded).",
  },
  activated: {
    term: "Activated",
    definition: "Member completed their first qualifying creative action at any point after signing up.",
  },
  d1: {
    term: "D1 Retained",
    definition:
      "Members whose account is at least 1 day old and who took a qualifying action after their signup day, within 1 day of signing up.",
  },
  d7: {
    term: "D7 Retained",
    definition:
      "Members whose account is at least 7 days old and who took a qualifying action after their signup day, within 7 days of signing up.",
  },
  d30: {
    term: "D30 Retained",
    definition:
      "Members whose account is at least 30 days old and who took a qualifying action after their signup day, within 30 days of signing up.",
  },
  active_plus: {
    term: "Active Plus Subscriber",
    definition:
      "A live-environment Plus subscription with status active and a current period that has not ended. Trials are counted separately and excluded from revenue.",
  },
  mrr: {
    term: "MRR",
    definition: `Active Plus subscribers × $${PLUS_MONTHLY_PRICE_USD.toFixed(2)}. Trials excluded; sandbox subscriptions excluded.`,
  },
  arr_run_rate: {
    term: "ARR Run Rate",
    definition: "Current MRR × 12. This is a run rate, not booked annual revenue.",
  },
  conversion: {
    term: "Free → Plus Conversion",
    definition: "Active Plus subscribers ÷ total countable members.",
  },
  churn: {
    term: "Churn",
    definition:
      "Not measurable yet: subscription status history is not retained, so cancellations cannot be attributed to a period.",
  },
  collab_application: {
    term: "Collab Application",
    definition:
      "A contact/application event sent by a signed-in member to a Collab post. Guest applications are counted separately.",
  },
  active_city: {
    term: "Active City",
    definition:
      "A city with at least one countable member whose home city it is and who took an action in the trailing 30 days.",
  },
  share_visits: {
    term: "Share-link visits",
    definition:
      "Recorded share events over the funnel window. This is share-link traffic, not total website sessions.",
  },
};

/* ---------- formatting + safe math ---------- */

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export type Delta =
  | { kind: "none" }
  | { kind: "absolute"; abs: number }
  | { kind: "percent"; abs: number; pct: number };

/** Never produce a percentage against a zero (or absent) prior period. */
export function delta(current: number | null | undefined, prior: number | null | undefined): Delta {
  if (current === null || current === undefined || prior === null || prior === undefined) return { kind: "none" };
  const abs = current - prior;
  if (!prior) return abs === 0 ? { kind: "none" } : { kind: "absolute", abs };
  return { kind: "percent", abs, pct: (abs / prior) * 100 };
}

export function formatDelta(d: Delta, periodLabel = "prior 30d"): string | null {
  if (d.kind === "none") return null;
  const sign = d.abs > 0 ? "+" : "";
  if (d.kind === "absolute") return `${sign}${fmtNumber(d.abs)} vs ${periodLabel}`;
  return `${sign}${fmtNumber(d.abs)} (${sign}${d.pct.toFixed(1)}%) vs ${periodLabel}`;
}

export type Ratio =
  | { kind: "insufficient"; numerator: number; denominator: number }
  | { kind: "ok"; pct: number; numerator: number; denominator: number; showCounts: boolean };

/** Percentages always carry their denominator while samples are small. */
export function ratio(numerator: number | null | undefined, denominator: number | null | undefined): Ratio {
  const n = numerator ?? 0;
  const d = denominator ?? 0;
  if (d < MIN_SAMPLE_FOR_PERCENT) return { kind: "insufficient", numerator: n, denominator: d };
  return {
    kind: "ok",
    pct: (n / d) * 100,
    numerator: n,
    denominator: d,
    showCounts: d < SMALL_SAMPLE_THRESHOLD,
  };
}

export function formatRatio(r: Ratio): string {
  if (r.kind === "insufficient") return `${fmtNumber(r.numerator)} of ${fmtNumber(r.denominator)}`;
  const pct = `${r.pct.toFixed(r.pct < 10 ? 1 : 0)}%`;
  return r.showCounts ? `${pct} · ${fmtNumber(r.numerator)} of ${fmtNumber(r.denominator)}` : pct;
}
