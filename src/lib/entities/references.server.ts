/**
 * The one reverse-reference read.
 *
 * Workshop already stores every connection between primitives in a semantic
 * table — `group_works`, `group_collabs`, `collab_posts.resulting_work_id`,
 * `event_showcase_items`, `blog_post_entity_tags`. What it lacked was a single
 * way to ask the mirror-image question: *given this entity, what else on
 * Workshop points at it?* Each page answered that with its own query, so a
 * Work knew about the stories written about it but not about the Collab it
 * came out of or the Group it lives in.
 *
 * This module answers that question once, for any entity, and returns
 * `WorkshopEntityRef`s so callers get canonical URLs from `workshopEntityUrl`
 * and can render them with the existing chip.
 *
 * Visibility: only publicly referenceable rows come back — the predicates in
 * `@/lib/entities/visibility` are the authority, exactly as they are for Blog
 * "About this post". Nothing private is exposed by asking in reverse.
 *
 * Server-only.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { makeEntityRef, type WorkshopEntityRef } from "@/lib/entities/kinds";
import {
  isCollabPubliclyReferenceable,
  isEventPubliclyReferenceable,
  isGroupPubliclyReferenceable,
  isWorkPubliclyReferenceable,
} from "@/lib/entities/visibility";
import { categoryLabel } from "@/lib/taxonomy";

/** Kinds this reader can be asked about. */
export type ReferenceSubjectKind = "work" | "collab" | "group" | "event";

export type EntityReferences = {
  works: WorkshopEntityRef[];
  collabs: WorkshopEntityRef[];
  groups: WorkshopEntityRef[];
  events: WorkshopEntityRef[];
};

const EMPTY: EntityReferences = { works: [], collabs: [], groups: [], events: [] };

const WORK_COLS = "id,slug,title,category,cover_url,status,visibility";
const COLLAB_COLS =
  "id,slug,title,description,status,archived_at,applications_open,resulting_work_id,ends_on";
const GROUP_COLS = "id,slug,name,tagline,avatar_url,visibility,deleted_at";
const EVENT_COLS =
  "id,slug,title,cover_url,starts_at,visibility,deleted_at,group:groups!group_events_group_id_fkey(slug,name,visibility,deleted_at)";

type WorkRow = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  status: string | null;
  visibility: string | null;
};

type CollabRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string | null;
  archived_at: string | null;
  applications_open: boolean | null;
  resulting_work_id: string | null;
  ends_on: string | null;
};

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  visibility: string | null;
  deleted_at: string | null;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  starts_at: string;
  visibility: string | null;
  deleted_at: string | null;
  group: { slug: string; name: string; visibility: string | null; deleted_at: string | null } | null;
};

function workRef(r: WorkRow): WorkshopEntityRef {
  return makeEntityRef(
    { kind: "work", slug: r.slug },
    { id: r.id, label: r.title, image: r.cover_url, sublabel: categoryLabel(r.category) },
  );
}

function collabRef(r: CollabRow): WorkshopEntityRef {
  return makeEntityRef(
    { kind: "collab", slug: r.slug },
    { id: r.id, label: r.title, image: null, sublabel: r.description ?? "Collab" },
  );
}

function groupRef(r: GroupRow): WorkshopEntityRef {
  return makeEntityRef(
    { kind: "group", slug: r.slug },
    { id: r.id, label: r.name, image: r.avatar_url, sublabel: r.tagline ?? "Group" },
  );
}

function eventRef(r: EventRow): WorkshopEntityRef {
  const when = new Date(r.starts_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return makeEntityRef(
    { kind: "event", slug: r.slug, groupSlug: r.group!.slug },
    { id: r.id, label: r.title, image: r.cover_url, sublabel: `${r.group!.name} · ${when}` },
  );
}

async function worksByIds(ids: string[]): Promise<WorkshopEntityRef[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from("works").select(WORK_COLS).in("id", ids);
  return ((data ?? []) as WorkRow[]).filter(isWorkPubliclyReferenceable).map(workRef);
}

async function collabsByIds(ids: string[]): Promise<WorkshopEntityRef[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from("collab_posts").select(COLLAB_COLS).in("id", ids);
  return ((data ?? []) as CollabRow[]).filter(isCollabPubliclyReferenceable).map(collabRef);
}

async function groupsByIds(ids: string[]): Promise<WorkshopEntityRef[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from("groups").select(GROUP_COLS).in("id", ids);
  return ((data ?? []) as GroupRow[]).filter(isGroupPubliclyReferenceable).map(groupRef);
}

async function eventsByIds(ids: string[]): Promise<WorkshopEntityRef[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin
    .from("group_events")
    .select(EVENT_COLS)
    .in("id", ids)
    .order("starts_at", { ascending: false });
  return ((data ?? []) as unknown as EventRow[])
    .filter((r) => !!r.group && isEventPubliclyReferenceable(r, r.group))
    .map(eventRef);
}

function idsOf(rows: Array<Record<string, unknown>> | null, key: string): string[] {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const v = r[key];
    if (typeof v === "string") out.add(v);
  }
  return Array.from(out);
}

/**
 * Everything publicly visible that points at `{ kind, id }`, grouped by kind.
 * Blog posts are deliberately excluded: they already have their own ranked,
 * trust-filtered rail in `listBlogPostsForEntityServer`.
 */
export async function listEntityReferencesServer(
  kind: ReferenceSubjectKind,
  entityId: string,
  limitPerKind = 6,
): Promise<EntityReferences> {
  const cap = (refs: WorkshopEntityRef[]) => refs.slice(0, limitPerKind);

  if (kind === "work") {
    const [groupRows, collabRows, showcaseRows] = await Promise.all([
      supabaseAdmin.from("group_works").select("group_id").eq("work_id", entityId),
      supabaseAdmin.from("collab_posts").select("id").eq("resulting_work_id", entityId),
      supabaseAdmin.from("event_showcase_items").select("event_id").eq("work_id", entityId),
    ]);
    const [groups, collabs, events] = await Promise.all([
      groupsByIds(idsOf(groupRows.data, "group_id")),
      collabsByIds(idsOf(collabRows.data, "id")),
      eventsByIds(idsOf(showcaseRows.data, "event_id")),
    ]);
    return { works: [], collabs: cap(collabs), groups: cap(groups), events: cap(events) };
  }

  if (kind === "collab") {
    const [groupRows, showcaseRows, born] = await Promise.all([
      supabaseAdmin.from("group_collabs").select("group_id").eq("collab_post_id", entityId),
      supabaseAdmin.from("event_showcase_items").select("event_id").eq("collab_id", entityId),
      supabaseAdmin.from("collab_posts").select("resulting_work_id").eq("id", entityId).maybeSingle(),
    ]);
    const workId = (born.data as { resulting_work_id: string | null } | null)?.resulting_work_id;
    const [groups, events, works] = await Promise.all([
      groupsByIds(idsOf(groupRows.data, "group_id")),
      eventsByIds(idsOf(showcaseRows.data, "event_id")),
      worksByIds(workId ? [workId] : []),
    ]);
    return { works: cap(works), collabs: [], groups: cap(groups), events: cap(events) };
  }

  if (kind === "event") {
    const { data } = await supabaseAdmin
      .from("event_showcase_items")
      .select("work_id,collab_id")
      .eq("event_id", entityId);
    const rows = (data ?? []) as Array<{ work_id: string | null; collab_id: string | null }>;
    const [works, collabs] = await Promise.all([
      worksByIds(idsOf(rows, "work_id")),
      collabsByIds(idsOf(rows, "collab_id")),
    ]);
    return { works: cap(works), collabs: cap(collabs), groups: [], events: [] };
  }

  if (kind === "group") {
    const [workRows, collabRows] = await Promise.all([
      supabaseAdmin
        .from("group_works")
        .select("work_id")
        .eq("group_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limitPerKind * 3),
      supabaseAdmin
        .from("group_collabs")
        .select("collab_post_id")
        .eq("group_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limitPerKind * 3),
    ]);
    const [works, collabs] = await Promise.all([
      worksByIds(idsOf(workRows.data, "work_id")),
      collabsByIds(idsOf(collabRows.data, "collab_post_id")),
    ]);
    return { works: cap(works), collabs: cap(collabs), groups: [], events: [] };
  }

  return EMPTY;
}
