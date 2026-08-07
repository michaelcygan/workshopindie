import {
  METRIC_DEFINITIONS,
  PLUS_MONTHLY_PRICE_USD,
  fmtNumber,
  fmtUsd,
  ratio,
} from "./definitions";

/**
 * Deterministic descriptive analytics. No LLM, no speculation — these are
 * plain-language restatements of numbers already on the page, so the read
 * can never contradict the tiles.
 */

export type Narrative = { text: string; tone: "up" | "down" | "flat" | "note" };

function pctChange(cur?: number | null, prev?: number | null): number | null {
  if (cur == null || prev == null || !prev) return null;
  return ((cur - prev) / prev) * 100;
}

function dir(p: number | null): "up" | "down" | "flat" {
  if (p == null) return "flat";
  if (p >= 5) return "up";
  if (p <= -5) return "down";
  return "flat";
}

export function pulseNarrative(
  kpi: any | null,
  revenue: any | null,
  cities: any[] = [],
): Narrative[] {
  if (!kpi)
    return [
      { text: "Analytics are unavailable right now, so no read can be generated.", tone: "note" },
    ];
  const out: Narrative[] = [];

  const signupsP = pctChange(kpi.signups_30d, kpi.signups_prev_30d);
  out.push({
    text:
      kpi.signups_30d === 0
        ? "No new members joined in the last 30 days."
        : signupsP == null
          ? `${fmtNumber(kpi.signups_30d)} members joined in the last 30 days (no comparable prior period).`
          : `${fmtNumber(kpi.signups_30d)} members joined in the last 30 days, ${signupsP >= 0 ? "up" : "down"} ${Math.abs(signupsP).toFixed(0)}% from the prior 30 days.`,
    tone: dir(signupsP),
  });

  const wacP = pctChange(kpi.wac, kpi.wac_prev);
  out.push({
    text: `${fmtNumber(kpi.wac)} members created something in the last 7 days${
      wacP == null
        ? ""
        : `, ${wacP >= 0 ? "up" : "down"} ${Math.abs(wacP).toFixed(0)}% week over week`
    }. Of ${fmtNumber(kpi.mau)} members active in 30 days, ${fmtNumber(kpi.mac)} did something creative.`,
    tone: dir(wacP),
  });

  const act = ratio(kpi.cohort_30d_activated, kpi.cohort_30d);
  out.push({
    text:
      act.kind === "insufficient"
        ? `Too few recent signups (${fmtNumber(kpi.cohort_30d)}) to read activation reliably.`
        : `${act.pct.toFixed(0)}% of the last 30 days of signups took a first creative action (${fmtNumber(act.numerator)} of ${fmtNumber(act.denominator)}).`,
    tone: act.kind === "insufficient" ? "note" : act.pct >= 40 ? "up" : "down",
  });

  const worksP = pctChange(kpi.works_30d, kpi.works_prev_30d);
  const collabsP = pctChange(kpi.collabs_30d, kpi.collabs_prev_30d);
  out.push({
    text: `Output over 30 days: ${fmtNumber(kpi.works_30d)} works${worksP == null ? "" : ` (${worksP >= 0 ? "+" : ""}${worksP.toFixed(0)}%)`}, ${fmtNumber(kpi.collabs_30d)} collabs${
      collabsP == null ? "" : ` (${collabsP >= 0 ? "+" : ""}${collabsP.toFixed(0)}%)`
    }, ${fmtNumber(kpi.events_30d)} events, ${fmtNumber(kpi.blog_30d)} blog posts.`,
    tone: dir(worksP ?? collabsP),
  });

  if (revenue) {
    const mrr = (revenue.live_active_paid ?? 0) * PLUS_MONTHLY_PRICE_USD;
    out.push({
      text:
        revenue.live_active_paid === 0
          ? "No paying members yet, so MRR is $0."
          : `${fmtNumber(revenue.live_active_paid)} paying members, ${fmtUsd(mrr)} MRR${revenue.live_trialing ? `, plus ${fmtNumber(revenue.live_trialing)} on trial` : ""}.`,
      tone: revenue.new_paid_30d > (revenue.new_paid_prev_30d ?? 0) ? "up" : "flat",
    });
  }

  const top = cities.filter((c) => c.members > 0).slice(0, 3);
  if (top.length) {
    out.push({
      text: `Strongest places: ${top.map((c) => `${c.name} (${fmtNumber(c.members)})`).join(", ")}.`,
      tone: "note",
    });
  }

  if ((kpi.open_reports ?? 0) > 0) {
    out.push({
      text: `${fmtNumber(kpi.open_reports)} moderation report${kpi.open_reports === 1 ? "" : "s"} awaiting review.`,
      tone: "down",
    });
  }

  return out;
}

export function retentionNarrative(retention: any[]): Narrative[] {
  if (!retention?.length) return [{ text: "Retention data is unavailable.", tone: "note" }];
  return retention
    .slice()
    .sort((a, b) => a.window_days - b.window_days)
    .map((r) => {
      const key = r.window_days === 1 ? "d1" : r.window_days === 7 ? "d7" : "d30";
      const rr = ratio(r.retained, r.eligible);
      return {
        text:
          rr.kind === "insufficient"
            ? `${METRIC_DEFINITIONS[key]?.term}: only ${fmtNumber(r.eligible)} members are old enough to measure — not enough to read.`
            : `${METRIC_DEFINITIONS[key]?.term}: ${rr.pct.toFixed(0)}% (${fmtNumber(rr.numerator)} of ${fmtNumber(rr.denominator)} eligible).`,
        tone: rr.kind === "insufficient" ? "note" : rr.pct >= 30 ? "up" : "down",
      } as Narrative;
    });
}

export function surfaceNarrative(surfaces: any[]): Narrative[] {
  const rows = (surfaces ?? []).filter((s) => s.surface !== "presence");
  if (!rows.length)
    return [{ text: "No surface activity recorded in the last 30 days.", tone: "note" }];
  const sorted = rows.slice().sort((a, b) => b.active_users - a.active_users);
  const top = sorted[0];
  const growing = rows
    .map((s) => ({ s, p: pctChange(s.active_users, s.prev_active_users) }))
    .filter((x) => x.p != null)
    .sort((a, b) => (b.p as number) - (a.p as number));
  const out: Narrative[] = [
    {
      text: `${top.surface} is the most-used surface: ${fmtNumber(top.active_users)} members, ${fmtNumber(top.actions)} actions in 30 days.`,
      tone: "note",
    },
  ];
  if (growing.length && (growing[0].p as number) > 0) {
    out.push({
      text: `Fastest growing: ${growing[0].s.surface} (+${(growing[0].p as number).toFixed(0)}% members vs prior 30 days).`,
      tone: "up",
    });
  }
  const falling = growing[growing.length - 1];
  if (falling && (falling.p as number) < -10) {
    out.push({
      text: `Falling: ${falling.s.surface} (${(falling.p as number).toFixed(0)}% members vs prior 30 days).`,
      tone: "down",
    });
  }
  return out;
}

export function geoNarrative(cities: any[]): Narrative[] {
  const rows = (cities ?? []).filter((c) => c.members > 0);
  if (!rows.length) return [{ text: "No members have set a home city yet.", tone: "note" }];
  const out: Narrative[] = [];
  const active = rows.filter((c) => (c.mau ?? 0) > 0);
  out.push({
    text: `${fmtNumber(rows.length)} cities have members; ${fmtNumber(active.length)} had someone active in the last 30 days.`,
    tone: "note",
  });
  const emerging = rows
    .filter((c) => (c.new_30d ?? 0) > (c.new_prev_30d ?? 0) && (c.new_30d ?? 0) > 0)
    .sort((a, b) => b.new_30d - a.new_30d)
    .slice(0, 3);
  if (emerging.length) {
    out.push({
      text: `Growing fastest: ${emerging.map((c) => `${c.name} (+${fmtNumber(c.new_30d)})`).join(", ")}.`,
      tone: "up",
    });
  }
  return out;
}
