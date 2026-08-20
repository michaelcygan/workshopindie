/**
 * Search-param plumbing shared by `/collab` and `/collab/remote`.
 *
 * Both routes carry the same secondary filters, and both must keep campaign
 * attribution (UTM tags + the Workshop tracking-click param) alive across
 * route normalization and filter navigation.
 */
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { TRACKING_CLICK_PARAM } from "@/lib/tracking-links.shared";

/** Filters that are not location: identical on both routes. */
export const secondaryFilterSchema = {
  cat: fallback(z.string(), "all").default("all"),
  topic: fallback(z.string(), "").default(""),
  comp: fallback(z.string(), "any").default("any"),
  sug: fallback(z.boolean(), false).default(false),
};

const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  TRACKING_CLICK_PARAM,
];

/** Campaign params only — safe to spread into any board navigation. */
export function campaignParams(search: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CAMPAIGN_KEYS) {
    const v = search[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

/** Secondary filters only — carried when switching between the two routes. */
export function secondaryParams(search: Record<string, unknown>) {
  return {
    cat: typeof search.cat === "string" ? search.cat : "all",
    topic: typeof search.topic === "string" ? search.topic : "",
    comp: typeof search.comp === "string" ? search.comp : "any",
    sug: search.sug === true,
  };
}
