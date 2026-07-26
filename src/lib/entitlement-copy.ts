/**
 * Central copy for Workshop Free/Plus gates.
 *
 * Every surface that hits a Free-tier limit should pull its title/body/CTA
 * from here so the product voice stays consistent (same wording, same reset
 * phrasing, same "Go Plus" CTA). No React deps — safe to import anywhere.
 *
 * Numbers come from `@/lib/entitlements` so changing a cap in one place
 * propagates through UI, upsells, and pricing bullets automatically.
 */
import {
  FREE_BLOG_PUBLICATIONS_PER_MONTH,
  FREE_LOUNGE_MINUTES_PER_MONTH,
  FREE_OPEN_COLLAB_CAP,
  FREE_PUBLISHED_WORK_CAP,
} from "@/lib/entitlements";

export const PLUS_CTA = "Go Plus for unlimited";
export const PLUS_PRICE_LINE = "$4.99/mo · 14-day free trial · cancel anytime";

export type GateCopy = {
  /** Sheet/dialog title. */
  title: string;
  /** Short body under the title. */
  body: string;
  /** Compact chip suitable for header rails. */
  chip: string;
  /** Call to action label. */
  cta: string;
};

/** Format 600 → "10 h", 90 → "1 h 30 min", 45 → "45 min". */
export function formatMinutes(mins: number): string {
  if (mins <= 0) return "0 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Blog publications monthly quota. */
export function blogQuotaCopy(
  used: number,
  cap: number = FREE_BLOG_PUBLICATIONS_PER_MONTH,
  resetLabel?: string,
): GateCopy {
  const reset = resetLabel ? ` Resets ${resetLabel}.` : "";
  return {
    title: `You've published ${cap} posts this month`,
    body: `Free includes ${cap} Blog publications per month.${reset} Go Plus for unlimited publishing.`,
    chip: `Published ${used} of ${cap} this month`,
    cta: PLUS_CTA,
  };
}

/** Lounge audio monthly quota. */
export function loungeAudioQuotaCopy(
  minutesUsed: number,
  minutesCap: number = FREE_LOUNGE_MINUTES_PER_MONTH,
  resetLabel?: string,
): GateCopy {
  const reset = resetLabel ? ` Resets ${resetLabel}.` : "";
  return {
    title: `You've used your ${formatMinutes(minutesCap)} of Lounge audio`,
    body: `Free includes ${formatMinutes(minutesCap)} of Lounge audio each month.${reset} You can still chat — Go Plus for unlimited audio.`,
    chip: `${minutesUsed} of ${minutesCap} min used${resetLabel ? ` · resets ${resetLabel}` : ""}`,
    cta: PLUS_CTA,
  };
}

/** Published Works portfolio cap (not monthly — lifetime published count). */
export function publishedWorkCapCopy(
  used: number,
  cap: number = FREE_PUBLISHED_WORK_CAP,
): GateCopy {
  return {
    title: `You've hit ${cap} published works`,
    body: `Free portfolios include ${cap} published Works. Go Plus for unlimited works.`,
    chip: `${used} of ${cap} published`,
    cta: PLUS_CTA,
  };
}

/** Open Collabs concurrent cap. */
export function openCollabCapCopy(
  used: number,
  cap: number = FREE_OPEN_COLLAB_CAP,
): GateCopy {
  return {
    title: `You've hit ${cap} active Collabs`,
    body: `Free can run ${cap} open Collabs at a time. Go Plus for unlimited.`,
    chip: `${used} of ${cap} active`,
    cta: PLUS_CTA,
  };
}

/**
 * Generic Plus upsell shown when no specific quota context is available.
 * Used as the default text on `<PlusGate>` when a caller doesn't pass copy.
 */
export const genericPlusCopy: GateCopy = {
  title: "Go Plus",
  body: "Free covers the complete Workshop within generous monthly limits. Plus removes the limits for $4.99/mo.",
  chip: "Free plan",
  cta: PLUS_CTA,
};

/** Pricing-page bullet text — Free tier. Kept in sync with entitlements. */
export function freePlanBullets(): string[] {
  return [
    `${FREE_PUBLISHED_WORK_CAP} published Works`,
    `${FREE_OPEN_COLLAB_CAP} active open Collabs`,
    `${formatMinutes(FREE_LOUNGE_MINUTES_PER_MONTH)} of Lounge audio each month`,
    `${FREE_BLOG_PUBLICATIONS_PER_MONTH} Blog publications each month`,
    "Unlimited Collab applications",
    "All cities, Groups, and Events",
    "DMs, comments, reactions, saves, and credits",
  ];
}

/** Pricing-page bullet text — Plus tier. */
export function plusPlanBullets(): string[] {
  return [
    "14 days free, then $4.99 per month",
    "Unlimited published Works",
    "Unlimited active open Collabs",
    "Unlimited Lounge audio",
    "Unlimited Blog publishing",
    "Everything included in Free",
    "Cancel anytime",
  ];
}
