/**
 * One place that decides whether a Workshop entity may be *referenced* in a
 * public context (a published Blog post, a public colophon, an OG card).
 *
 * Referenceable is not the same as recruiting, and not the same as
 * discoverable-in-a-feed. A finished Collab is no longer taking collaborators
 * but is still legitimate historical context for a story about it. A past
 * public Event is still valid context for a story written after the fact.
 *
 * Rules delegate to the existing domain helpers wherever those already exist,
 * so there is never a second definition of "public Collab".
 *
 * Client-safe: pure predicates over already-fetched rows.
 */

import { isPubliclyVisible as collabIsPubliclyVisible } from "@/lib/collab/lifecycle";
import type { CollabLifecycleRecord } from "@/lib/collab/lifecycle";

export type WorkVisibilityRecord = {
  status?: string | null;
  visibility?: string | null;
};

export type GroupVisibilityRecord = {
  visibility?: string | null;
  deleted_at?: string | null;
};

export type EventVisibilityRecord = {
  visibility?: string | null;
  deleted_at?: string | null;
};

export type ProfileVisibilityRecord = {
  username?: string | null;
  discoverable?: boolean | null;
};

/**
 * Works. `unlisted` means "reachable by direct link" — it is deliberately not
 * promoted into public editorial context, and drafts/private never are.
 */
export function isWorkPubliclyReferenceable(w: WorkVisibilityRecord): boolean {
  return w.status === "published" && w.visibility === "public";
}

/** Collabs. Delegates to the lifecycle helper the Collab pages already use. */
export function isCollabPubliclyReferenceable(c: CollabLifecycleRecord): boolean {
  return collabIsPubliclyVisible(c);
}

/** Groups. Unlisted groups are link-only; deleted groups are gone. */
export function isGroupPubliclyReferenceable(g: GroupVisibilityRecord): boolean {
  return g.visibility === "public" && !g.deleted_at;
}

/**
 * Events. The enum is `public | group_only | unlisted` — there is no `private`
 * value, so a check against "private" never fires. A group-only event must not
 * become public just because a public post points at it, and an event can
 * never out-live its group's own visibility.
 */
export function isEventPubliclyReferenceable(
  e: EventVisibilityRecord,
  group: GroupVisibilityRecord | null | undefined,
): boolean {
  if (e.visibility !== "public" || e.deleted_at) return false;
  if (!group) return false;
  return isGroupPubliclyReferenceable(group);
}

/** Profiles. Needs a handle to have a URL at all, and must be discoverable. */
export function isProfilePubliclyReferenceable(p: ProfileVisibilityRecord): boolean {
  return !!p.username && p.discoverable !== false;
}

export type BlogPostVisibilityRecord = {
  status?: string | null;
  show_in_blog_index?: boolean | null;
  published_at?: string | null;
};

/**
 * Blog posts. A story is referenceable only once it is genuinely live: it must
 * be published, listed in the Blog index, and past its publication time.
 * Drafts, scheduled posts and unlisted posts stay out of public colophons.
 */
export function isBlogPostPubliclyReferenceable(
  p: BlogPostVisibilityRecord,
  now: Date = new Date(),
): boolean {
  if (p.status !== "published") return false;
  if (p.show_in_blog_index !== true) return false;
  if (!p.published_at) return false;
  const at = new Date(p.published_at).getTime();
  return Number.isFinite(at) && at <= now.getTime();
}
