/**
 * One Workshop entity search.
 *
 * Before this module, the same "find me a Work / Collab / Group / Event /
 * person" query existed twice with different rules: once in
 * `mention-suggestions.ts` for the `@` popover, and once in
 * `blog-entity-tag-picker.tsx` for Blog "About this post". They disagreed —
 * most visibly on Collabs, where the Blog picker only offered *recruiting*
 * collabs, so a writer could not connect a story to the finished collab it was
 * about.
 *
 * Search now has one implementation with two *contexts*:
 *
 *  - `conversation` — typing `@` in Today, Lounge or a DM. Biased to what the
 *    viewer is doing right now: their own work, their groups, upcoming events.
 *  - `editorial` — authoring durable context on a Blog post. Biased to the
 *    complete public record, including finished collabs and past events.
 *
 * Contexts change ranking and recency, never privacy: nothing appears here
 * that the viewer could not already reach, and RLS remains the enforcement
 * boundary. Results are returned as `WorkshopEntityRef`s so every caller gets
 * the same canonical URL from `workshopEntityUrl`.
 *
 * Client-safe: browser Supabase client, no server imports.
 */

import { supabase } from "@/integrations/supabase/client";
import { NON_PUBLIC_STATUSES, RECRUITING_DEADLINE_OR } from "@/lib/collab/query";
import { DISCOVERABLE_STATUSES } from "@/lib/events/filters";
import { makeEntityRef, type WorkshopEntityRef } from "@/lib/entities/kinds";

export type EntitySearchContext = "conversation" | "editorial";

export type EntitySearchOptions = {
  query: string;
  viewerId?: string | null;
  context?: EntitySearchContext;
  limit?: number;
};

/** A search hit: a canonical ref plus the extra bits pickers like to show. */
export type EntitySearchHit = WorkshopEntityRef & {
  /** True when the viewer owns this — drives "Your piece" / "Your collab". */
  mine?: boolean;
  /** Free-form Work format, when known. */
  subtype?: string | null;
  category?: string | null;
  /** Not publicly visible yet (owner-only pick). */
  state?: "Draft" | "Unlisted" | null;
};

const DEFAULT_LIMIT = 8;

function titleCase(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function dedupe(hits: EntitySearchHit[], limit: number): EntitySearchHit[] {
  const seen = new Set<string>();
  const out: EntitySearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------- Works

type WorkRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  subtype: string | null;
  cover_url: string | null;
  status: string | null;
  visibility: string | null;
};

const WORK_FIELDS = "id,slug,title,category,subtype,cover_url,status,visibility";

function workHit(r: WorkRow, mine: boolean): EntitySearchHit {
  const state = r.status !== "published" ? "Draft" : r.visibility !== "public" ? "Unlisted" : null;
  const base = r.subtype || titleCase(r.category) || "Work";
  return {
    ...makeEntityRef(
      { kind: "work", slug: r.slug },
      {
        id: r.id,
        label: r.title,
        image: r.cover_url,
        sublabel: [state, mine && !state ? "Your piece" : null, base].filter(Boolean).join(" · "),
      },
    ),
    mine,
    subtype: r.subtype,
    category: r.category,
    state,
  };
}

/**
 * Public published Works, with the viewer's own Works (any status) ranked
 * first so a draft they are about to publish is still connectable.
 */
export async function searchWorks(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const { query, viewerId } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const context = opts.context ?? "conversation";
  const q = query.trim();

  const minePromise = viewerId
    ? (() => {
        let r = supabase
          .from("works")
          .select(WORK_FIELDS)
          .eq("created_by", viewerId)
          .order("updated_at", { ascending: false })
          .limit(limit);
        // Conversation surfaces only insert links other people can open.
        if (context === "conversation") {
          r = r.eq("status", "published").in("visibility", ["public", "unlisted"]);
        }
        if (q) r = r.ilike("title", `%${q}%`);
        return r;
      })()
    : null;

  let pub = supabase
    .from("works")
    .select(WORK_FIELDS)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (q) pub = pub.ilike("title", `%${q}%`);

  const [mineRes, pubRes] = await Promise.all([minePromise, pub]);
  const mineRows = ((mineRes?.data ?? []) as WorkRow[]).map((r) => workHit(r, true));
  const pubRows = ((pubRes.data ?? []) as WorkRow[]).map((r) => workHit(r, false));
  return dedupe([...mineRows, ...pubRows], limit);
}

// -------------------------------------------------------------- Collabs

type CollabRow = { id: string; slug: string; title: string; description: string | null };

function collabHit(r: CollabRow, mine: boolean, sublabel?: string | null): EntitySearchHit {
  return {
    ...makeEntityRef(
      { kind: "collab", slug: r.slug },
      {
        id: r.id,
        label: r.title,
        image: null,
        sublabel: sublabel ?? (mine ? "Your collab" : (r.description ?? null)),
      },
    ),
    mine,
  };
}

/**
 * Conversation: collabs still taking people, viewer's own first — you mention
 * a collab to pull someone into it.
 *
 * Editorial: every publicly visible collab, recruiting or finished. A story
 * about a wrapped collab must be able to point at it.
 */
export async function searchCollabs(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const { query, viewerId } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const context = opts.context ?? "conversation";
  const q = query.trim();

  const base = () =>
    supabase
      .from("collab_posts")
      .select("id,slug,title,description")
      .is("archived_at", null)
      .not("status", "in", NON_PUBLIC_STATUSES);

  const recruitingOnly = <T extends ReturnType<typeof base>>(r: T) =>
    r.is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR());

  const out: EntitySearchHit[] = [];

  if (viewerId) {
    let mine = base()
      .eq("user_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (context === "conversation") mine = recruitingOnly(mine);
    if (q) mine = mine.ilike("title", `%${q}%`);
    const { data } = await mine;
    out.push(...((data ?? []) as CollabRow[]).map((r) => collabHit(r, true)));
  }

  if (out.length < limit) {
    let all = base().order("created_at", { ascending: false }).limit(limit);
    if (context === "conversation") all = recruitingOnly(all);
    if (q) all = all.ilike("title", `%${q}%`);
    const { data } = await all;
    out.push(...((data ?? []) as CollabRow[]).map((r) => collabHit(r, false)));
  }

  return dedupe(out, limit);
}

// --------------------------------------------------------------- Groups

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
};

function groupHit(r: GroupRow, mine: boolean): EntitySearchHit {
  return {
    ...makeEntityRef(
      { kind: "group", slug: r.slug },
      {
        id: r.id,
        label: r.name,
        image: r.avatar_url,
        sublabel: r.tagline || (mine ? "Group you're in" : "Group"),
      },
    ),
    mine,
  };
}

/** The viewer's groups first (including unlisted ones they belong to), then public search. */
export async function searchGroups(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const { query, viewerId } = opts;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const q = query.trim();
  const out: EntitySearchHit[] = [];

  if (viewerId) {
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", viewerId)
      .limit(200);
    const ids = (memberRows ?? []).map((r) => r.group_id as string);
    if (ids.length > 0) {
      let mine = supabase
        .from("groups")
        .select("id,slug,name,tagline,avatar_url")
        .in("id", ids)
        .is("deleted_at", null)
        .limit(limit);
      if (q) mine = mine.ilike("name", `%${q}%`);
      const { data } = await mine;
      out.push(...((data ?? []) as GroupRow[]).map((r) => groupHit(r, true)));
    }
  }

  if (out.length < limit) {
    let pub = supabase
      .from("groups")
      .select("id,slug,name,tagline,avatar_url")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(limit);
    if (q) pub = pub.ilike("name", `%${q}%`);
    const { data } = await pub;
    out.push(...((data ?? []) as GroupRow[]).map((r) => groupHit(r, false)));
  }

  return dedupe(out, limit);
}

// --------------------------------------------------------------- Events

type EventRow = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  starts_at: string;
  group: { slug: string; name: string } | null;
};

/**
 * Public, discoverable events under a resolvable group. Conversation looks
 * forward (what you can still attend); editorial looks back (what already
 * happened and got written about).
 */
export async function searchEvents(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const context = opts.context ?? "conversation";
  const q = opts.query.trim();
  const upcoming = context === "conversation";

  let req = supabase
    .from("group_events")
    .select("id,slug,title,cover_url,starts_at,group:groups!group_events_group_id_fkey(slug,name)")
    .is("deleted_at", null)
    .eq("visibility", "public")
    .in("status", DISCOVERABLE_STATUSES as unknown as never)
    .order("starts_at", { ascending: upcoming })
    .limit(limit * 2);
  if (upcoming) req = req.gte("starts_at", new Date().toISOString());
  if (q) req = req.ilike("title", `%${q}%`);

  const { data } = await req;
  const rows = ((data ?? []) as unknown as EventRow[]).filter((r) => r.group?.slug);
  return dedupe(
    rows.map((r) => {
      const when = new Date(r.starts_at).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return {
        ...makeEntityRef(
          { kind: "event", slug: r.slug, groupSlug: r.group!.slug },
          {
            id: r.id,
            label: r.title,
            image: r.cover_url,
            sublabel: `${r.group!.name} · ${when}`,
          },
        ),
      } satisfies EntitySearchHit;
    }),
    limit,
  );
}

// ------------------------------------------------------------- Profiles

/** People by handle prefix or display name. Always requires a query. */
export async function searchProfiles(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const q = opts.query.trim();
  if (!q) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,headline")
    .or(`username.ilike.${q}%,display_name.ilike.%${q}%`)
    .not("username", "is", null)
    .limit(limit);
  return (
    (data ?? []) as Array<{
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      headline: string | null;
    }>
  )
    .filter((r) => r.username)
    .map((r) =>
      makeEntityRef(
        { kind: "profile", username: r.username! },
        {
          id: r.id,
          label: r.display_name || r.username!,
          image: r.avatar_url,
          sublabel: r.headline ?? `@${r.username}`,
        },
      ),
    );
}

// ----------------------------------------------------------- Blog posts

/** Live blog posts (published, listed, past their publish time). */
export async function searchBlogPosts(opts: EntitySearchOptions): Promise<EntitySearchHit[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const q = opts.query.trim();
  let req = supabase
    .from("blog_posts")
    .select("id,slug,title,author_name,cover_image_url,published_at")
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (q) req = req.ilike("title", `%${q}%`);
  const { data } = await req;
  return (
    (data ?? []) as Array<{
      id: string;
      slug: string;
      title: string;
      author_name: string | null;
      cover_image_url: string | null;
    }>
  ).map((r) =>
    makeEntityRef(
      { kind: "post", slug: r.slug },
      {
        id: r.id,
        label: r.title,
        image: r.cover_image_url,
        sublabel: r.author_name || "Post",
      },
    ),
  );
}
