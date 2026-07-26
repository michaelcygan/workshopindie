/**
 * Central entitlement definitions for Workshop Free / Plus.
 *
 * Safe to import from client and server code — no runtime side effects,
 * no browser globals. Server-side quota enforcement is authoritative; these
 * constants and the `resolveEntitlements` helper drive UI copy and
 * best-effort client checks that must agree with the server.
 *
 * Product rules (source of truth):
 *   - Free: 10 published Works, 2 open Collabs, 10 h/mo Lounge audio,
 *     2 Blog publications / UTC calendar month. Drafts unlimited.
 *   - Plus: everything unlimited. Only removes operating limits — no status,
 *     ranking, priority, or badge changes.
 *   - Unlimited is represented as `null` (never a large sentinel number).
 */

export const FREE_PUBLISHED_WORK_CAP = 10;
export const FREE_OPEN_COLLAB_CAP = 2;
export const FREE_LOUNGE_MINUTES_PER_MONTH = 600; // 10 hours
export const FREE_BLOG_PUBLICATIONS_PER_MONTH = 2;

export type WorkshopTier = "free" | "plus";

export type WorkshopEntitlements = {
  tier: WorkshopTier;

  maxPublishedWorks: number | null;
  maxOpenCollabs: number | null;

  loungeMinutesPerMonth: number | null;
  blogPublicationsPerMonth: number | null;

  canCreateBlogDrafts: boolean;
  canEditExistingBlogPosts: boolean;
  canUnpublishBlogPosts: boolean;
};

/** Legacy shape used before the effective-Plus resolver landed. Kept so
 * older call sites reading the raw `subscriptions` row continue to compile;
 * new code should pass an `EffectivePlusAccess` from the resolver. */
export type SubscriptionLike = {
  tier?: string | null;
  status?: string | null;
  current_period_end?: string | null;
} | null;

import type { EffectivePlusAccess } from "./plus-access";

const PLUS_BUNDLE: WorkshopEntitlements = {
  tier: "plus",
  maxPublishedWorks: null,
  maxOpenCollabs: null,
  loungeMinutesPerMonth: null,
  blogPublicationsPerMonth: null,
  canCreateBlogDrafts: true,
  canEditExistingBlogPosts: true,
  canUnpublishBlogPosts: true,
};

const FREE_BUNDLE: WorkshopEntitlements = {
  tier: "free",
  maxPublishedWorks: FREE_PUBLISHED_WORK_CAP,
  maxOpenCollabs: FREE_OPEN_COLLAB_CAP,
  loungeMinutesPerMonth: FREE_LOUNGE_MINUTES_PER_MONTH,
  blogPublicationsPerMonth: FREE_BLOG_PUBLICATIONS_PER_MONTH,
  canCreateBlogDrafts: true,
  canEditExistingBlogPosts: true,
  canUnpublishBlogPosts: true,
};

/**
 * Return the entitlement bundle for a subscription record OR an
 * `EffectivePlusAccess` from the resolver. Complimentary and lifetime grants
 * yield the identical Plus bundle — Plus only removes operating limits, it
 * never confers ranking, badges, or admin capabilities.
 */
export function resolveEntitlements(
  input: SubscriptionLike | EffectivePlusAccess,
): WorkshopEntitlements {
  // EffectivePlusAccess has an `isPlus` boolean the SubscriptionLike shape lacks.
  if (input && typeof (input as EffectivePlusAccess).isPlus === "boolean") {
    return (input as EffectivePlusAccess).isPlus ? PLUS_BUNDLE : FREE_BUNDLE;
  }

  const sub = input as SubscriptionLike;
  const isPlus =
    !!sub &&
    sub.tier === "plus" &&
    (sub.status === "active" || sub.status === "trialing") &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

  return isPlus ? PLUS_BUNDLE : FREE_BUNDLE;
}

