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

/** Shape used by `usePlus` and the webhook-populated `subscriptions` row. */
export type SubscriptionLike = {
  tier?: string | null;
  status?: string | null;
  current_period_end?: string | null;
} | null;

/**
 * Return the entitlement bundle for a subscription record.
 *
 * Plus is granted only when the row explicitly says `tier === "plus"` and
 * the subscription is `active` or `trialing` with a future (or missing)
 * `current_period_end`. Everything else — including `lapsed`, `canceled`,
 * `past_due` beyond grace, and no row — resolves to Free. Callers that need
 * to distinguish "used to be Plus" from "never Plus" (e.g. cancellation
 * banners) should inspect the raw subscription separately.
 */
export function resolveEntitlements(sub: SubscriptionLike): WorkshopEntitlements {
  const isPlus =
    !!sub &&
    sub.tier === "plus" &&
    (sub.status === "active" || sub.status === "trialing") &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

  if (isPlus) {
    return {
      tier: "plus",
      maxPublishedWorks: null,
      maxOpenCollabs: null,
      loungeMinutesPerMonth: null,
      blogPublicationsPerMonth: null,
      canCreateBlogDrafts: true,
      canEditExistingBlogPosts: true,
      canUnpublishBlogPosts: true,
    };
  }

  return {
    tier: "free",
    maxPublishedWorks: FREE_PUBLISHED_WORK_CAP,
    maxOpenCollabs: FREE_OPEN_COLLAB_CAP,
    loungeMinutesPerMonth: FREE_LOUNGE_MINUTES_PER_MONTH,
    blogPublicationsPerMonth: FREE_BLOG_PUBLICATIONS_PER_MONTH,
    canCreateBlogDrafts: true,
    canEditExistingBlogPosts: true,
    canUnpublishBlogPosts: true,
  };
}

// Compatibility re-exports so existing imports keep working while callers
// migrate to the new names. Do not add new call sites for these aliases.
/** @deprecated Use FREE_PUBLISHED_WORK_CAP. */
export const FREE_PORTFOLIO_CAP = FREE_PUBLISHED_WORK_CAP;
