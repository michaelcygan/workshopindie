import { NON_PUBLIC_STATUSES, RECRUITING_DEADLINE_OR } from "@/lib/collab/query";
/**
 * Server-only helpers for the homepage.
 *
 * Home is an orchestration layer: everything here reads existing tables and
 * returns the client-safe view models in `@/lib/home-types`. No new content
 * primitive, no feed table, no ranking infrastructure — just deterministic,
 * explainable selection over the product graph.
 *
 * Kept out of `home.functions.ts` because TanStack Start's serverfn split
 * transform strips sibling module-scope declarations from that module.
 */

import { supabaseAdmin as rawSupabaseAdmin } from "@/integrations/supabase/client.server";
import { span, traceClient } from "@/lib/perf/query-trace.server";
import { DISCOVERABLE_STATUSES } from "@/lib/events/filters";
import type {
  HomeBlogCard,
  HomeCircleStory,
  HomeContinueAction,
  HomeDisciplineItem,
  HomeEvent,
  HomeGroupSuggestion,
  HomeLounge,
  HomeMineItem,
  HomePersonSuggestion,
  HomeStoryCredit,
  HomeStoryLabel,
  HomeTodaySummary,
  HomeWorkStory,
  MemberHomePayload,
  PublicBlogCard,
  PublicCollabCall,
  PublicGroupScene,
  PublicHomePayload,
  PublicWorkTile,
} from "@/lib/home-types";

/**
 * Traced admin client. Identical behaviour to the raw client; when a trace is
 * active (see `withTrace`) each query records table, op chain and duration.
 */
const supabaseAdmin = traceClient(rawSupabaseAdmin);


const POST_SCAN_LIMIT = 40;
const MAX_WORK_STORIES = 8;
const MAX_STORIES_PER_WORK = 3;
/** Admins may feature at most this many Blog posts at once. */
export const FEATURED_POST_CAP = 5;
const MAX_MINE_ITEMS = 6;

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  created_by: string | null;
  author_profile_id: string | null;
  publication_type: string | null;
};

type CreditRow = {
  work_id: string;
  user_id: string | null;
  role_label: string | null;
  sort_order: number | null;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type AuthorRow = {
  blog_post_id: string;
  profile_id: string;
  role_label: string | null;
  sort_order: number | null;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function storyLabel(
  post: PostRow,
  trustedCreators: Set<string>,
  authorIds: string[],
): HomeStoryLabel {
  if (post.publication_type && post.publication_type !== "member") return "workshop";
  if (authorIds.some((id) => trustedCreators.has(id))) return "process";
  return "story";
}

/**
 * Batched Work ↔ Blog composites for "Stories around the Work".
 *
 * Five queries total regardless of result size — never the per-post tag
 * resolver in a loop. Ranking uses blog `published_at` / story count / work
 * publish date; never `blog_post_entity_tags.created_at`, which the atomic
 * tag-replacement RPC rewrites on every save.
 */
export async function listHomeWorkStoriesServer(): Promise<HomeWorkStory[]> {
  const nowIso = new Date().toISOString();

  const { data: postData, error: postErr } = await supabaseAdmin
    .from("blog_posts")
    .select(
      "id,slug,title,excerpt,cover_image_url,author_name,published_at,created_by,author_profile_id,publication_type",
    )
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(POST_SCAN_LIMIT);
  if (postErr) throw new Error(postErr.message);
  const posts = (postData ?? []) as unknown as PostRow[];
  if (!posts.length) return [];

  const postIds = posts.map((p) => p.id);
  const { data: tagData } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("blog_post_id,work_id,sort_order")
    .in("blog_post_id", postIds)
    .not("work_id", "is", null)
    .order("sort_order", { ascending: true });
  const tagRows = (tagData ?? []) as unknown as Array<{
    blog_post_id: string;
    work_id: string;
    sort_order: number | null;
  }>;
  if (!tagRows.length) return [];

  const workIds = Array.from(new Set(tagRows.map((t) => t.work_id)));

  const [worksRes, creditsRes, authorsRes] = await Promise.all([
    supabaseAdmin
      .from("works")
      .select(
        "id,slug,title,excerpt,cover_url,cover_focal_x,cover_focal_y,category,categories,published_at,created_by,status,visibility",
      )
      .in("id", workIds)
      .eq("status", "published")
      .eq("visibility", "public"),
    supabaseAdmin
      .from("work_credits")
      .select("work_id,user_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)")
      .in("work_id", workIds)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("blog_post_authors")
      .select(
        "blog_post_id,profile_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)",
      )
      .in("blog_post_id", postIds)
      .order("sort_order", { ascending: true }),
  ]);

  type WorkRow = {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    cover_focal_x: number | null;
    cover_focal_y: number | null;
    category: string | null;
    categories: string[] | null;
    published_at: string | null;
    created_by: string;
  };
  const works = new Map<string, WorkRow>(
    ((worksRes.data ?? []) as unknown as WorkRow[]).map((w) => [w.id, w]),
  );
  if (works.size === 0) return [];

  const creditsByWork = new Map<string, CreditRow[]>();
  for (const c of (creditsRes.data ?? []) as unknown as CreditRow[]) {
    const arr = creditsByWork.get(c.work_id) ?? [];
    arr.push(c);
    creditsByWork.set(c.work_id, arr);
  }

  const authorsByPost = new Map<string, AuthorRow[]>();
  for (const a of (authorsRes.data ?? []) as unknown as AuthorRow[]) {
    const arr = authorsByPost.get(a.blog_post_id) ?? [];
    arr.push(a);
    authorsByPost.set(a.blog_post_id, arr);
  }

  const postById = new Map(posts.map((p) => [p.id, p]));

  // A post may tag several Works — assign it deterministically to its first
  // eligible Work so the same story never repeats across the carousel.
  const assigned = new Set<string>();
  const byWork = new Map<string, PostRow[]>();

  for (const tag of tagRows) {
    if (assigned.has(tag.blog_post_id)) continue;
    const work = works.get(tag.work_id);
    if (!work) continue;
    const post = postById.get(tag.blog_post_id);
    if (!post) continue;

    // Trusted context: the Work creator, a credited collaborator, or a
    // Workshop editorial publication. Arbitrary third-party tags do not get
    // prominent distribution.
    const trusted = new Set<string>([work.created_by]);
    for (const c of creditsByWork.get(work.id) ?? []) if (c.user_id) trusted.add(c.user_id);
    const authorIds = [
      post.created_by,
      post.author_profile_id,
      ...(authorsByPost.get(post.id) ?? []).map((a) => a.profile_id),
    ].filter(Boolean) as string[];
    const isEditorial = !!post.publication_type && post.publication_type !== "member";
    if (!isEditorial && !authorIds.some((id) => trusted.has(id))) continue;

    assigned.add(post.id);
    const arr = byWork.get(work.id) ?? [];
    arr.push(post);
    byWork.set(work.id, arr);
  }

  const out: HomeWorkStory[] = [];
  for (const [workId, workPosts] of byWork) {
    const work = works.get(workId)!;
    const trusted = new Set<string>([work.created_by]);
    for (const c of creditsByWork.get(workId) ?? []) if (c.user_id) trusted.add(c.user_id);

    const sorted = workPosts
      .slice()
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));

    out.push({
      work: {
        id: work.id,
        slug: work.slug,
        title: work.title,
        excerpt: work.excerpt,
        cover_url: work.cover_url,
        cover_focal_x: work.cover_focal_x,
        cover_focal_y: work.cover_focal_y,
        categories: (work.categories ?? []).length
          ? (work.categories as string[])
          : work.category
            ? [work.category]
            : [],
        published_at: work.published_at,
      },
      credits: (creditsByWork.get(workId) ?? []).slice(0, 3).map<HomeStoryCredit>((c) => ({
        id: c.user_id ?? c.profiles?.id ?? "",
        username: c.profiles?.username ?? null,
        display_name: c.profiles?.display_name ?? null,
        avatar_url: c.profiles?.avatar_url ?? null,
        role_label: c.role_label ?? null,
      })),
      stories: sorted.slice(0, MAX_STORIES_PER_WORK).map((p) => {
        const authors = authorsByPost.get(p.id) ?? [];
        const authorIds = [
          p.created_by,
          p.author_profile_id,
          ...authors.map((a) => a.profile_id),
        ].filter(Boolean) as string[];
        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          cover_image_url: p.cover_image_url,
          published_at: p.published_at,
          label: storyLabel(p, trusted, authorIds),
          author_name: p.author_name,
          authors: authors.slice(0, 3).map<HomeStoryCredit>((a) => ({
            id: a.profile_id,
            username: a.profiles?.username ?? null,
            display_name: a.profiles?.display_name ?? null,
            avatar_url: a.profiles?.avatar_url ?? null,
            role_label: a.role_label ?? null,
          })),
        };
      }),
      storyCount: sorted.length,
    });
  }

  return out
    .sort((a, b) => {
      const at = a.stories[0]?.published_at ?? a.work.published_at ?? "";
      const bt = b.stories[0]?.published_at ?? b.work.published_at ?? "";
      if (bt !== at) return bt.localeCompare(at);
      return b.storyCount - a.storyCount;
    })
    .slice(0, MAX_WORK_STORIES);
}

// ═══════════════════════════ Member home ═══════════════════════════

async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const [out, inb] = await Promise.all([
    supabaseAdmin.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", userId),
    supabaseAdmin.from("user_blocks").select("blocker_user_id").eq("blocked_user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const r of out.data ?? []) ids.add((r as { blocked_user_id: string }).blocked_user_id);
  for (const r of inb.data ?? []) ids.add((r as { blocker_user_id: string }).blocker_user_id);
  return ids;
}

type MyGroup = {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
  tagline: string | null;
};

async function myGroupsFor(userId: string): Promise<MyGroup[]> {
  const { data: mem } = await supabaseAdmin
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .limit(200);
  const ids = (mem ?? []).map((m) => (m as { group_id: string }).group_id);
  if (!ids.length) return [];
  const { data } = await supabaseAdmin
    .from("groups")
    .select("id,slug,name,avatar_url,member_count,tagline,deleted_at")
    .in("id", ids);
  return ((data ?? []) as unknown as Array<MyGroup & { deleted_at: string | null }>)
    .filter((g) => !g.deleted_at)
    .map(({ id, slug, name, avatar_url, member_count, tagline }) => ({
      id,
      slug,
      name,
      avatar_url,
      member_count,
      tagline,
    }));
}

/** Unexpired Today posts in the viewer's Groups, summarized per Group. */
export async function todaySummariesServer(
  groups: MyGroup[],
  blocked: Set<string>,
): Promise<HomeTodaySummary[]> {
  if (!groups.length) return [];
  const { data } = await supabaseAdmin
    .from("group_today_posts")
    .select(
      "id,group_id,author_id,body,created_at,author:profiles!group_today_posts_author_profile_fkey(username,display_name,avatar_url)",
    )
    .in(
      "group_id",
      groups.map((g) => g.id),
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(300);

  type Row = {
    id: string;
    group_id: string;
    author_id: string;
    body: string;
    created_at: string;
    author: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !blocked.has(r.author_id));
  const byGroup = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byGroup.get(r.group_id) ?? [];
    arr.push(r);
    byGroup.set(r.group_id, arr);
  }

  const out: HomeTodaySummary[] = [];
  for (const g of groups) {
    const list = byGroup.get(g.id);
    if (!list || !list.length) continue;
    const latest = list[0];
    out.push({
      groupId: g.id,
      groupSlug: g.slug,
      groupName: g.name,
      groupAvatar: g.avatar_url,
      postCount: list.length,
      latestBody: latest.body,
      latestAuthor: latest.author,
      latestAt: latest.created_at,
    });
  }
  // Recency and volume together: a Group talking right now should beat one
  // that merely accumulated more posts earlier in the day.
  const nowMs = Date.now();
  const score = (s: HomeTodaySummary) => {
    const ageH = s.latestAt ? (nowMs - new Date(s.latestAt).getTime()) / 3_600_000 : 24;
    return Math.log2(s.postCount + 1) + 3 / (1 + Math.max(0, ageH));
  };
  return out.sort((a, b) => score(b) - score(a)).slice(0, 4);
}

/** Active Lounges (instant_rooms) inside the viewer's Groups, with presence. */
export async function myGroupLoungesServer(groups: MyGroup[]): Promise<HomeLounge[]> {
  if (!groups.length) return [];
  const groupIds = groups.map((g) => g.id);
  const { data: rooms } = await supabaseAdmin
    .from("instant_rooms")
    .select("id,title,medium,group_id")
    .in("group_id", groupIds)
    .eq("status", "active")
    .limit(30);
  const roomRows = (rooms ?? []) as unknown as Array<{
    id: string;
    title: string | null;
    medium: string | null;
    group_id: string;
  }>;
  if (!roomRows.length) return [];

  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: presence } = await supabaseAdmin
    .from("instant_presence")
    .select("room_id,user_id")
    .in(
      "room_id",
      roomRows.map((r) => r.id),
    )
    .gt("last_seen_at", since)
    .limit(500);
  const presenceRows = (presence ?? []) as unknown as Array<{ room_id: string; user_id: string }>;

  const userIds = Array.from(new Set(presenceRows.map((p) => p.user_id)));
  const avatarById = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,avatar_url")
      .in("id", userIds.slice(0, 100));
    for (const p of (profs ?? []) as Array<{ id: string; avatar_url: string | null }>) {
      avatarById.set(p.id, p.avatar_url);
    }
  }

  const byRoom = new Map<string, string[]>();
  for (const p of presenceRows) {
    const arr = byRoom.get(p.room_id) ?? [];
    arr.push(p.user_id);
    byRoom.set(p.room_id, arr);
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));
  return roomRows
    .flatMap<HomeLounge>((r) => {
      const g = groupById.get(r.group_id);
      if (!g) return [];
      const members = byRoom.get(r.id) ?? [];
      return [
        {
          roomId: r.id,
          title: r.title ?? "Lounge",
          medium: r.medium,
          groupId: g.id,
          groupName: g.name,
          groupSlug: g.slug,
          liveCount: members.length,
          avatars: members
            .map((id) => avatarById.get(id) ?? null)
            .filter((a): a is string => !!a)
            .slice(0, 4),
        },
      ];
    })
    .sort((a, b) => b.liveCount - a.liveCount)
    .slice(0, 4);
}

const EVENT_SELECT =
  "id,group_id,slug,title,starts_at,format,cover_url,venue_name,venue_city_id,online_url,visibility,deleted_at";

/** Upcoming Events, ranked: RSVPed > joined Group > home city > online. */
export async function upcomingEventsServer(
  userId: string,
  groups: MyGroup[],
  homeCityId: string | null,
  max = 4,
): Promise<HomeEvent[]> {
  const nowIso = new Date().toISOString();

  type Row = {
    id: string;
    group_id: string;
    slug: string;
    title: string;
    starts_at: string;
    format: string | null;
    cover_url: string | null;
    venue_name: string | null;
    venue_city_id: string | null;
    online_url: string | null;
  };

  const { data: rsvps } = await supabaseAdmin
    .from("group_event_rsvps")
    .select("event_id,status")
    .eq("user_id", userId)
    .in("status", ["going", "maybe"]);
  const rsvpIds = ((rsvps ?? []) as Array<{ event_id: string }>).map((r) => r.event_id);

  const groupIds = groups.map((g) => g.id);

  async function fetchEvents(
    apply: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>,
    // `group_only` rows may only be surfaced for groups the viewer belongs to.
    allowGroupOnly = false,
  ) {
    const { data } = await apply(baseQuery(allowGroupOnly));
    return (data ?? []) as unknown as Row[];
  }
  function baseQuery(allowGroupOnly: boolean) {
    return supabaseAdmin
      .from("group_events")
      .select(EVENT_SELECT)
      .gt("starts_at", nowIso)
      .is("deleted_at", null)
      .in("status", DISCOVERABLE_STATUSES as unknown as never)
      .in("visibility", allowGroupOnly ? ["public", "group_only"] : ["public"])
      .order("starts_at", { ascending: true })
      .limit(5);
  }

  const candidates: Array<{ row: Row; reason: HomeEvent["reason"]; rsvped: boolean }> = [];
  const seen = new Set<string>();
  const push = (row: Row, reason: HomeEvent["reason"], rsvped: boolean) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    candidates.push({ row, reason, rsvped });
  };

  if (rsvpIds.length) {
    // The viewer already RSVPed, so a group_only row is one they could see.
    for (const row of await fetchEvents((q) => q.in("id", rsvpIds), true)) push(row, "rsvp", true);
  }
  if (candidates.length < max && groupIds.length) {
    for (const row of await fetchEvents((q) => q.in("group_id", groupIds), true)) {
      push(row, "group", false);
    }
  }
  if (candidates.length < max && homeCityId) {
    for (const row of await fetchEvents((q) => q.eq("venue_city_id", homeCityId))) {
      push(row, "city", false);
    }
  }
  if (candidates.length < max) {
    for (const row of await fetchEvents((q) => q.eq("format", "online"))) {
      push(row, "online", false);
    }
  }

  if (!candidates.length) return [];

  const picks = candidates.slice(0, max);
  const groupIdsNeeded = Array.from(new Set(picks.map((p) => p.row.group_id)));
  const cityIdsNeeded = Array.from(
    new Set(picks.map((p) => p.row.venue_city_id).filter((c): c is string => !!c)),
  );
  const [{ data: groupRows }, { data: cityRows }] = await Promise.all([
    supabaseAdmin.from("groups").select("id,slug,name").in("id", groupIdsNeeded),
    cityIdsNeeded.length
      ? supabaseAdmin.from("cities").select("id,name").in("id", cityIdsNeeded)
      : Promise.resolve({ data: [] }),
  ]);
  const groupById = new Map(
    ((groupRows ?? []) as Array<{ id: string; slug: string; name: string }>).map((g) => [g.id, g]),
  );
  const cityById = new Map(
    ((cityRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );

  return picks.flatMap<HomeEvent>((pick) => {
    const g = groupById.get(pick.row.group_id);
    if (!g) return [];
    return [
      {
        id: pick.row.id,
        slug: pick.row.slug,
        title: pick.row.title,
        startsAt: pick.row.starts_at,
        locationMode: pick.row.format,
        venueName: pick.row.venue_name,
        cityName: pick.row.venue_city_id ? (cityById.get(pick.row.venue_city_id) ?? null) : null,
        coverUrl: pick.row.cover_url,
        groupSlug: g.slug,
        groupName: g.name,
        rsvped: pick.rsvped,
        reason: pick.reason,
      },
    ];
  });
}

/** One upcoming Event (mobile Now module keeps the first result). */
export async function nextEventServer(
  userId: string,
  groups: MyGroup[],
  homeCityId: string | null,
): Promise<HomeEvent | null> {
  const list = await upcomingEventsServer(userId, groups, homeCityId, 1);
  return list[0] ?? null;
}

/** Deterministic "Continue making" resolver — at most three actions. */
export async function continueActionsServer(
  userId: string,
  groups: MyGroup[],
  todays: HomeTodaySummary[],
): Promise<{ actions: HomeContinueAction[]; hasEligibleWork: boolean }> {
  const actions: HomeContinueAction[] = [];

  const [draftsRes, myWorksRes, collabsRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from("blog_posts")
      .select("id,title,updated_at,cover_image_url")
      .eq("created_by", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("works")
      .select("id,slug,title,cover_url,published_at")
      .eq("created_by", userId)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("collab_posts")
      .select("id,slug,title")
      .eq("user_id", userId)
      .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
      .limit(10),
    supabaseAdmin
      .from("profiles")
      .select("headline,bio,avatar_url,mediums")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const draft = (
    (draftsRes.data ?? []) as Array<{
      id: string;
      title: string;
      cover_image_url: string | null;
    }>
  )[0];
  if (draft) {
    actions.push({
      kind: "blog_draft",
      title: draft.title?.trim() || "Untitled draft",
      detail: "Pick up where you left off.",
      actionLabel: "Continue writing",
      to: "/me/blog/$id",
      params: { id: draft.id },
      coverUrl: draft.cover_image_url,
    });
  }

  const collabs = (collabsRes.data ?? []) as Array<{ id: string; slug: string; title: string }>;
  if (collabs.length) {
    const { data: contacts } = await supabaseAdmin
      .from("collab_contact_events")
      .select("collab_post_id")
      .in(
        "collab_post_id",
        collabs.map((c) => c.id),
      )
      .gt("sent_at", new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString());
    const counts = new Map<string, number>();
    for (const c of (contacts ?? []) as Array<{ collab_post_id: string }>) {
      counts.set(c.collab_post_id, (counts.get(c.collab_post_id) ?? 0) + 1);
    }
    const top = collabs
      .map((c) => ({ c, n: counts.get(c.id) ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)[0];
    if (top) {
      actions.push({
        kind: "collab_applicants",
        title: top.c.title,
        detail: `${top.n} ${top.n === 1 ? "person" : "people"} reached out.`,
        actionLabel: "Review applicants",
        to: "/collab/$slug",
        params: { slug: top.c.slug },
      });
    }
  }

  // A published Work of yours with no trusted story yet.
  const myWorks = (myWorksRes.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    cover_url: string | null;
  }>;
  let eligibleWork: (typeof myWorks)[number] | null = null;
  if (myWorks.length) {
    const { data: tagged } = await supabaseAdmin
      .from("blog_post_entity_tags")
      .select("work_id,blog_post:blog_posts!inner(status,created_by)")
      .in(
        "work_id",
        myWorks.map((w) => w.id),
      );
    const covered = new Set<string>();
    for (const t of (tagged ?? []) as unknown as Array<{
      work_id: string;
      blog_post: { status: string; created_by: string | null } | null;
    }>) {
      if (t.blog_post?.status === "published") covered.add(t.work_id);
    }
    eligibleWork = myWorks.find((w) => !covered.has(w.id)) ?? null;
    if (eligibleWork) {
      actions.push({
        kind: "work_needs_story",
        title: eligibleWork.title,
        detail: "This Work has no story yet.",
        actionLabel: "Tell the story behind this Work",
        to: null,
        workId: eligibleWork.id,
        coverUrl: eligibleWork.cover_url,
      });
    }
  }

  if (actions.length < 3 && groups.length) {
    const { data: mine } = await supabaseAdmin
      .from("group_today_posts")
      .select("group_id")
      .eq("author_id", userId)
      .gt("expires_at", new Date().toISOString());
    const posted = new Set(((mine ?? []) as Array<{ group_id: string }>).map((r) => r.group_id));
    const quiet =
      groups.find((g) => !posted.has(g.id) && todays.some((t) => t.groupId === g.id)) ??
      groups.find((g) => !posted.has(g.id));
    if (quiet) {
      actions.push({
        kind: "introduce_in_today",
        title: quiet.name,
        detail: todays.some((t) => t.groupId === quiet.id)
          ? "Today's board is moving — jump in."
          : "Start today's conversation.",
        actionLabel: "Post in Today",
        to: "/g/$slug",
        params: { slug: quiet.slug },
      });
    }
  }

  if (actions.length < 3) {
    const profile = profileRes.data as {
      headline: string | null;
      bio: string | null;
      avatar_url: string | null;
      mediums: string[] | null;
    } | null;
    if (!myWorks.length) {
      actions.push({
        kind: "first_work",
        title: "Post your first Work",
        detail: "Start your portfolio and credit the people who helped.",
        actionLabel: "Post to Gallery",
        to: "/works/new",
      });
    } else if (
      profile &&
      (!profile.headline || !profile.avatar_url || !(profile.mediums ?? []).length)
    ) {
      actions.push({
        kind: "complete_profile",
        title: "Finish your profile",
        detail: "A headline, an avatar, and your mediums help people find you.",
        actionLabel: "Edit profile",
        to: "/me/edit",
      });
    }
  }

  return { actions: actions.slice(0, 3), hasEligibleWork: !!eligibleWork };
}

/** Group recommendations for members with no Groups: home city, then mediums. */
export async function groupSuggestionsServer(
  homeCityId: string | null,
  mediums: string[],
): Promise<HomeGroupSuggestion[]> {
  const out: HomeGroupSuggestion[] = [];
  const seen = new Set<string>();

  async function add(
    reason: string,
    apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>,
  ) {
    const { data } = await apply(base());
    for (const g of (data ?? []) as unknown as Array<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      avatar_url: string | null;
      member_count: number;
    }>) {
      if (seen.has(g.id) || out.length >= 3) continue;
      seen.add(g.id);
      out.push({
        id: g.id,
        slug: g.slug,
        name: g.name,
        tagline: g.tagline,
        avatarUrl: g.avatar_url,
        memberCount: g.member_count,
        reason,
      });
    }
  }
  function base() {
    return supabaseAdmin
      .from("groups")
      .select("id,slug,name,tagline,avatar_url,member_count")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("member_count", { ascending: false })
      .limit(3);
  }

  if (homeCityId) await add("In your city", (q) => q.eq("city_id", homeCityId));
  if (out.length < 3 && mediums.length)
    await add("Matches your mediums", (q) => q.eq("kind", "genre"));
  if (out.length < 3) await add("Active on Workshop", (q) => q);
  return out.slice(0, 3);
}

const CIRCLE_LIMIT = 12;
const PER_SOURCE_CAP = 3;

/** Bounded, explainable mixed rail from the viewer's real relationships. */
export async function circleStoriesServer(
  userId: string,
  groups: MyGroup[],
  blocked: Set<string>,
): Promise<HomeCircleStory[]> {
  const { data: followRows } = await supabaseAdmin
    .from("follows")
    .select("followed_user_id")
    .eq("follower_user_id", userId)
    .limit(300);
  const followed = ((followRows ?? []) as Array<{ followed_user_id: string }>)
    .map((r) => r.followed_user_id)
    .filter((id) => !blocked.has(id));

  // Frequent credited collaborators.
  const { data: myCredits } = await supabaseAdmin
    .from("work_credits")
    .select("work_id")
    .eq("user_id", userId)
    .limit(100);
  const myWorkIds = ((myCredits ?? []) as Array<{ work_id: string }>).map((r) => r.work_id);
  const collaborators = new Set<string>();
  if (myWorkIds.length) {
    const { data: peers } = await supabaseAdmin
      .from("work_credits")
      .select("user_id")
      .in("work_id", myWorkIds)
      .limit(300);
    for (const p of (peers ?? []) as Array<{ user_id: string | null }>) {
      if (p.user_id && p.user_id !== userId && !blocked.has(p.user_id))
        collaborators.add(p.user_id);
    }
  }

  const peopleIds = Array.from(new Set([...followed, ...collaborators])).slice(0, 200);
  const groupIds = groups.map((g) => g.id);
  const nowIso = new Date().toISOString();

  const [worksRes, postsRes, collabsRes, eventsRes, namesRes] = await Promise.all([
    peopleIds.length
      ? supabaseAdmin
          .from("works")
          .select(
            "id,slug,title,excerpt,cover_url,category,created_by,published_at,source_collab_post_id",
          )
          .in("created_by", peopleIds)
          .eq("status", "published")
          .eq("visibility", "public")
          .order("published_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    peopleIds.length
      ? supabaseAdmin
          .from("blog_posts")
          .select("id,slug,title,excerpt,cover_image_url,created_by,published_at")
          .in("created_by", peopleIds)
          .eq("status", "published")
          .eq("show_in_blog_index", true)
          .lte("published_at", nowIso)
          .order("published_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    peopleIds.length
      ? supabaseAdmin
          .from("collab_posts")
          .select("id,slug,title,description,category,user_id,created_at")
          .in("user_id", peopleIds)
          .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    groupIds.length
      ? supabaseAdmin
          .from("group_events")
          .select("id,slug,title,starts_at,cover_url,group_id")
          .in("group_id", groupIds)
          .gt("starts_at", nowIso)
          .is("deleted_at", null)
          .in("status", DISCOVERABLE_STATUSES as unknown as never)
          .in("visibility", ["public", "group_only"])

          .order("starts_at", { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] }),
    peopleIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .in("id", peopleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map(
    (
      (namesRes.data ?? []) as Array<{
        id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }>
    ).map((p) => [p.id, p]),
  );
  const followedSet = new Set(followed);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  function person(id: string): HomeStoryCredit[] {
    const p = nameById.get(id);
    return p
      ? [
          {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            role_label: null,
          },
        ]
      : [];
  }
  function label(id: string) {
    const p = nameById.get(id);
    return p?.display_name || p?.username || "someone you know";
  }

  const items: HomeCircleStory[] = [];

  for (const w of (worksRes.data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    category: string;
    created_by: string;
    published_at: string | null;
    source_collab_post_id: string | null;
  }>) {
    if (blocked.has(w.created_by)) continue;
    const fromCollab = !!w.source_collab_post_id;
    items.push({
      id: `work:${w.id}`,
      kind: "work",
      title: w.title,
      subtitle: w.excerpt,
      coverUrl: w.cover_url,
      occurredAt: w.published_at,
      reason: fromCollab ? "collab" : followedSet.has(w.created_by) ? "follow" : "collaborator",
      reasonText: fromCollab
        ? `From a Collab · ${label(w.created_by)}`
        : followedSet.has(w.created_by)
          ? `You follow ${label(w.created_by)}`
          : `Made with ${label(w.created_by)}`,
      to: "/works/$slug",
      params: { slug: w.slug },
      people: person(w.created_by),
    });
  }

  for (const p of (postsRes.data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    created_by: string | null;
    published_at: string | null;
  }>) {
    if (!p.created_by || blocked.has(p.created_by)) continue;
    items.push({
      id: `blog:${p.id}`,
      kind: "blog",
      title: p.title,
      subtitle: p.excerpt,
      coverUrl: p.cover_image_url,
      occurredAt: p.published_at,
      reason: followedSet.has(p.created_by) ? "follow" : "collaborator",
      reasonText: followedSet.has(p.created_by)
        ? `You follow ${label(p.created_by)}`
        : `Written by ${label(p.created_by)}`,
      to: "/blog/$slug",
      params: { slug: p.slug },
      people: person(p.created_by),
    });
  }

  for (const c of (collabsRes.data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    user_id: string;
    created_at: string;
  }>) {
    if (blocked.has(c.user_id)) continue;
    items.push({
      id: `collab:${c.id}`,
      kind: "collab",
      title: c.title,
      subtitle: c.description,
      coverUrl: null,
      occurredAt: c.created_at,
      reason: "collab",
      reasonText: `Open Collab from ${label(c.user_id)}`,
      to: "/collab/$slug",
      params: { slug: c.slug },
      people: person(c.user_id),
    });
  }

  for (const e of (eventsRes.data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    cover_url: string | null;
    group_id: string;
  }>) {
    const g = groupById.get(e.group_id);
    if (!g) continue;
    items.push({
      id: `event:${e.id}`,
      kind: "event",
      title: e.title,
      subtitle: new Date(e.starts_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      coverUrl: e.cover_url,
      occurredAt: e.starts_at,
      reason: "group",
      reasonText: `From ${g.name}`,
      to: "/g/$slug/e/$eventSlug",
      params: { slug: g.slug, eventSlug: e.slug },
      people: [],
    });
  }

  // Deterministic ranking + per-source caps so one prolific person or Group
  // cannot dominate the rail.
  const kindRank: Record<HomeCircleStory["kind"], number> = {
    event: 0,
    collab: 1,
    work: 2,
    blog: 3,
  };
  const sorted = items.sort((a, b) => {
    if (kindRank[a.kind] !== kindRank[b.kind]) return kindRank[a.kind] - kindRank[b.kind];
    return (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "");
  });

  const perSource = new Map<string, number>();
  const out: HomeCircleStory[] = [];
  for (const item of sorted) {
    const key = item.people[0]?.id ?? item.reasonText;
    const n = perSource.get(key) ?? 0;
    if (n >= PER_SOURCE_CAP) continue;
    perSource.set(key, n + 1);
    out.push(item);
    if (out.length >= CIRCLE_LIMIT) break;
  }
  return out;
}

/** People from the viewer's Groups they don't follow yet. */
export async function peopleSuggestionsServer(
  userId: string,
  groups: MyGroup[],
  blocked: Set<string>,
  homeCityId: string | null,
  mediums: string[],
): Promise<HomePersonSuggestion[]> {
  if (!groups.length) return [];
  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id,group_id")
    .in(
      "group_id",
      groups.map((g) => g.id),
    )
    .limit(500);
  const rows = (members ?? []) as Array<{ user_id: string; group_id: string }>;

  const { data: followRows } = await supabaseAdmin
    .from("follows")
    .select("followed_user_id")
    .eq("follower_user_id", userId);
  const following = new Set(
    ((followRows ?? []) as Array<{ followed_user_id: string }>).map((r) => r.followed_user_id),
  );

  const sharedGroup = new Map<string, string>();
  for (const r of rows) {
    if (r.user_id === userId || following.has(r.user_id) || blocked.has(r.user_id)) continue;
    if (!sharedGroup.has(r.user_id)) sharedGroup.set(r.user_id, r.group_id);
  }
  const ids = Array.from(sharedGroup.keys()).slice(0, 60);
  if (!ids.length) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,username,display_name,headline,avatar_url,mediums,home_city_id,discoverable")
    .in("id", ids)
    .eq("discoverable", true)
    .limit(60);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const mySet = new Set(mediums);
  return (
    (profiles ?? []) as unknown as Array<{
      id: string;
      username: string | null;
      display_name: string | null;
      headline: string | null;
      avatar_url: string | null;
      mediums: string[] | null;
      home_city_id: string | null;
    }>
  )
    .filter((p) => !!p.username)
    .map((p) => {
      const shared = (p.mediums ?? []).filter((m) => mySet.has(m));
      const g = groupById.get(sharedGroup.get(p.id)!);
      const reasonText = shared.length
        ? `Shares your ${shared[0]} work`
        : homeCityId && p.home_city_id === homeCityId
          ? "In your city"
          : g
            ? `Also in ${g.name}`
            : "In one of your Groups";
      return {
        id: p.id,
        username: p.username!,
        displayName: p.display_name,
        headline: p.headline,
        avatarUrl: p.avatar_url,
        mediums: (p.mediums ?? []).slice(0, 3),
        reasonText,
      };
    })
    .slice(0, 6);
}

/** A small, medium-diverse editorial set. Adjacent picks need a real bridge. */
export async function disciplineItemsServer(mediums: string[]): Promise<HomeDisciplineItem[]> {
  const { data } = await supabaseAdmin
    .from("works")
    .select("id,slug,title,excerpt,cover_url,category,embed_url,source_type,published_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(60);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    category: string;
    embed_url: string | null;
    source_type: string | null;
  }>;

  const seen = new Set<string>();
  const out: HomeDisciplineItem[] = [];
  const mySet = new Set(mediums);
  for (const w of rows) {
    if (seen.has(w.category)) continue;
    seen.add(w.category);
    out.push({
      id: w.id,
      slug: w.slug,
      title: w.title,
      category: w.category,
      coverUrl: w.cover_url,
      excerpt: w.excerpt,
      embedUrl: w.embed_url,
      sourceType: w.source_type,
      bridge: mySet.has(w.category) ? "Your medium" : null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * The single authenticated Home payload. Every section is fault-isolated —
 * a failure loading Events can never blank Today, Lounge, or Continue.
 */
export async function getMemberHomeServer(userId: string): Promise<MemberHomePayload> {
  const [profileRes, blocked, groups] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("display_name,username,first_name,cover_url,cover_work_id,home_city_id,mediums")
      .eq("id", userId)
      .maybeSingle(),
    blockedIdsFor(userId),
    myGroupsFor(userId),
  ]);

  const profile = profileRes.data as {
    display_name: string | null;
    username: string | null;
    first_name: string | null;
    cover_url: string | null;
    cover_work_id: string | null;
    home_city_id: string | null;
    mediums: string[] | null;
  } | null;
  const mediums = profile?.mediums ?? [];
  const homeCityId = profile?.home_city_id ?? null;

  const today = await todaySummariesServer(groups, blocked).catch(() => [] as HomeTodaySummary[]);

  const [
    loungesR,
    eventsR,
    continueR,
    suggestR,
    circleR,
    peopleR,
    disciplineR,
    coverWorkR,
    featuredR,
    mineR,
    cityR,
    cityGroupR,
  ] = await Promise.allSettled([
    myGroupLoungesServer(groups),
    upcomingEventsServer(userId, groups, homeCityId, 4),
    continueActionsServer(userId, groups, today),
    groups.length
      ? Promise.resolve([] as HomeGroupSuggestion[])
      : groupSuggestionsServer(homeCityId, mediums),
    circleStoriesServer(userId, groups, blocked),
    peopleSuggestionsServer(userId, groups, blocked, homeCityId, mediums),
    disciplineItemsServer(mediums),
    profile?.cover_work_id
      ? supabaseAdmin
          .from("works")
          .select("slug,title")
          .eq("id", profile.cover_work_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    featuredBlogServer(),
    myWorkshopServer(userId),
    homeCityId
      ? supabaseAdmin.from("cities").select("id,name,slug").eq("id", homeCityId).maybeSingle()
      : Promise.resolve({ data: null }),
    homeCityId
      ? supabaseAdmin
          .from("groups")
          .select("id,name,slug")
          .eq("city_id", homeCityId)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("member_count", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lounges = loungesR.status === "fulfilled" ? loungesR.value : [];
  const upcomingEvents = eventsR.status === "fulfilled" ? eventsR.value : [];
  const cont =
    continueR.status === "fulfilled" ? continueR.value : { actions: [], hasEligibleWork: false };
  const featured =
    featuredR.status === "fulfilled"
      ? featuredR.value
      : { posts: [] as HomeBlogCard[], isFallback: false };
  const mine = mineR.status === "fulfilled" ? mineR.value : [];

  const blogRail = await blogRailServer([
    ...featured.posts.map((p) => p.id),
    ...mine.filter((m) => m.kind === "blog").map((m) => m.id),
  ]).catch(() => [] as HomeBlogCard[]);

  // Prefer a Group with Today activity for the "open a Lounge" fallback.
  const fallbackGroup =
    groups.find((g) => today.some((t) => t.groupId === g.id)) ?? groups[0] ?? null;

  return {
    greetingName: profile?.first_name || profile?.display_name || profile?.username || null,
    coverUrl: profile?.cover_url ?? null,
    coverWork:
      coverWorkR.status === "fulfilled" && coverWorkR.value.data
        ? (coverWorkR.value.data as { slug: string; title: string })
        : null,
    today,
    lounges,
    loungeFallbackGroup: fallbackGroup
      ? { slug: fallbackGroup.slug, name: fallbackGroup.name }
      : null,
    nextEvent: upcomingEvents[0] ?? null,
    continueActions: cont.actions,
    groupSuggestions: suggestR.status === "fulfilled" ? suggestR.value : [],
    circle: circleR.status === "fulfilled" ? circleR.value : [],
    people: peopleR.status === "fulfilled" ? peopleR.value : [],
    disciplines: disciplineR.status === "fulfilled" ? disciplineR.value : [],
    hasEligibleWorkToWriteAbout: cont.hasEligibleWork,
    featuredPosts: featured.posts,
    featuredIsFallback: featured.isFallback,
    mine,
    blogRail,
    homeCity:
      cityR.status === "fulfilled" && cityR.value.data
        ? (cityR.value.data as { id: string; name: string; slug: string | null })
        : null,
    homeCityGroup:
      cityGroupR.status === "fulfilled" && cityGroupR.value.data
        ? (cityGroupR.value.data as { id: string; name: string; slug: string })
        : null,
    nowGroups: groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
    mediums,
    upcomingEvents,
  };
}

/* ───────────────────── Blog: featured header + rail ───────────────────── */

const BLOG_CARD_COLS =
  "id,slug,title,excerpt,cover_image_url,author_name,published_at,category_slug,author_profile:profiles!blog_posts_author_profile_id_fkey(display_name,avatar_url)";

type BlogCardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  category_slug: string | null;
  author_profile: { display_name: string | null; avatar_url: string | null } | null;
};

function toBlogCard(r: BlogCardRow): HomeBlogCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverUrl: r.cover_image_url,
    categorySlug: r.category_slug ?? null,
    publishedAt: r.published_at,
    authorName: r.author_profile?.display_name || r.author_name,
    authorAvatar: r.author_profile?.avatar_url ?? null,
  };
}

/** Up to 5 admin-featured posts; falls back to the newest indexed post. */
export async function featuredBlogServer(): Promise<{
  posts: HomeBlogCard[];
  isFallback: boolean;
}> {
  const now = new Date().toISOString();
  const base = () =>
    supabaseAdmin
      .from("blog_posts")
      .select(BLOG_CARD_COLS)
      .eq("status", "published")
      .eq("show_in_blog_index", true)
      .lte("published_at", now)
      .order("published_at", { ascending: false });

  const { data } = await base().eq("featured", true).limit(FEATURED_POST_CAP);
  const rows = (data ?? []) as unknown as BlogCardRow[];
  if (rows.length) return { posts: rows.map(toBlogCard), isFallback: false };

  const { data: latest } = await base().limit(1);
  const fb = (latest ?? []) as unknown as BlogCardRow[];
  return { posts: fb.map(toBlogCard), isFallback: true };
}

/** Recent public Blog posts for the "From the Blog" rail. */
export async function blogRailServer(excludeIds: string[]): Promise<HomeBlogCard[]> {
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select(BLOG_CARD_COLS)
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(12);
  const seen = new Set(excludeIds);
  return ((data ?? []) as unknown as BlogCardRow[])
    .filter((r) => !seen.has(r.id))
    .slice(0, 6)
    .map(toBlogCard);
}

/* ───────────────────────────── Your Workshop ───────────────────────────── */

/**
 * The signed-in member's own recent material. Scoped to `userId` on every
 * query, so it may safely include profile-only Blog posts
 * (`show_in_blog_index = false`) and unlisted Works — those never reach the
 * public rails. Drafts and private Works are always excluded.
 */
export async function myWorkshopServer(userId: string): Promise<HomeMineItem[]> {
  const [worksRes, creditsRes, postsRes, authoredRes, collabsRes] = await Promise.all([
    supabaseAdmin
      .from("works")
      .select("id,slug,title,excerpt,cover_url,cover_focal_x,cover_focal_y,visibility,published_at")
      .eq("created_by", userId)
      .eq("status", "published")
      .in("visibility", ["public", "unlisted"])
      .order("published_at", { ascending: false })
      .limit(8),
    supabaseAdmin.from("work_credits").select("work_id").eq("user_id", userId).limit(30),
    supabaseAdmin
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_image_url,published_at,show_in_blog_index")
      .eq("created_by", userId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("blog_post_authors")
      .select("blog_post_id")
      .eq("profile_id", userId)
      .limit(30),
    supabaseAdmin
      .from("collab_posts")
      .select("id,slug,title,description,created_at")
      .eq("user_id", userId)
      .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const ownWorks = (worksRes.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    cover_focal_x: number | null;
    cover_focal_y: number | null;
    visibility: string;
    published_at: string | null;
  }>;
  const ownIds = new Set(ownWorks.map((w) => w.id));

  const creditIds = ((creditsRes.data ?? []) as Array<{ work_id: string }>)
    .map((c) => c.work_id)
    .filter((id) => !ownIds.has(id));
  let creditedWorks: typeof ownWorks = [];
  if (creditIds.length) {
    const { data } = await supabaseAdmin
      .from("works")
      .select("id,slug,title,excerpt,cover_url,cover_focal_x,cover_focal_y,visibility,published_at")
      .in("id", creditIds.slice(0, 20))
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(6);
    creditedWorks = (data ?? []) as typeof ownWorks;
  }

  type PostLite = {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string | null;
  };
  const posts = new Map<string, PostLite>();
  for (const p of (postsRes.data ?? []) as PostLite[]) posts.set(p.id, p);

  const authoredIds = ((authoredRes.data ?? []) as Array<{ blog_post_id: string }>)
    .map((a) => a.blog_post_id)
    .filter((id) => !posts.has(id));
  if (authoredIds.length) {
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_image_url,published_at")
      .in("id", authoredIds.slice(0, 20))
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6);
    for (const p of (data ?? []) as PostLite[]) posts.set(p.id, p);
  }

  const collabs = (collabsRes.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    created_at: string;
  }>;

  const buckets: HomeMineItem[][] = [
    ownWorks.map((w) => ({
      id: w.id,
      kind: "work" as const,
      label: w.visibility === "unlisted" ? "Your Work · Unlisted" : "Your Work",
      title: w.title,
      subtitle: w.excerpt,
      coverUrl: w.cover_url,
      focalX: w.cover_focal_x,
      focalY: w.cover_focal_y,
      to: "/works/$slug",
      params: { slug: w.slug },
      occurredAt: w.published_at,
    })),
    [...posts.values()].map((p) => ({
      id: p.id,
      kind: "blog" as const,
      label: "Your story",
      title: p.title,
      subtitle: p.excerpt,
      coverUrl: p.cover_image_url,
      focalX: null,
      focalY: null,
      to: "/blog/$slug",
      params: { slug: p.slug },
      occurredAt: p.published_at,
    })),
    creditedWorks.map((w) => ({
      id: w.id,
      kind: "credited_work" as const,
      label: "Credited Work",
      title: w.title,
      subtitle: w.excerpt,
      coverUrl: w.cover_url,
      focalX: w.cover_focal_x,
      focalY: w.cover_focal_y,
      to: "/works/$slug",
      params: { slug: w.slug },
      occurredAt: w.published_at,
    })),
    collabs.map((c) => ({
      id: c.id,
      kind: "collab" as const,
      label: "Your Collab",
      title: c.title,
      subtitle: c.description ? c.description.slice(0, 140) : "Open for collaborators",
      coverUrl: null,
      focalX: null,
      focalY: null,
      to: "/collab/$slug",
      params: { slug: c.slug },
      occurredAt: c.created_at,
    })),
  ];

  // Image-bearing items lead inside each bucket, then round-robin across
  // buckets so a single content type can't consume the whole rail.
  for (const b of buckets) {
    b.sort((a, z) => {
      if (!!a.coverUrl !== !!z.coverUrl) return a.coverUrl ? -1 : 1;
      return (z.occurredAt ?? "").localeCompare(a.occurredAt ?? "");
    });
  }
  const out: HomeMineItem[] = [];
  for (let i = 0; out.length < MAX_MINE_ITEMS && i < 8; i++) {
    for (const b of buckets) {
      const item = b[i];
      if (item && out.length < MAX_MINE_ITEMS) out.push(item);
    }
  }
  return out;
}

/* ─────────────────────── Public (logged-out) home ─────────────────────── */

const PUBLIC_BLOG_COLS =
  "id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,category_slug,author_profile:profiles!blog_posts_author_profile_id_fkey(display_name,avatar_url)";

type PublicBlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string | null;
  published_at: string | null;
  category_slug: string | null;
  author_profile: { display_name: string | null; avatar_url: string | null } | null;
};

function toPublicBlogCard(r: PublicBlogRow): PublicBlogCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverUrl: r.cover_image_url,
    coverAlt: r.cover_image_alt,
    categorySlug: r.category_slug ?? null,
    publishedAt: r.published_at,
    authorName: r.author_profile?.display_name || r.author_name,
    authorAvatar: r.author_profile?.avatar_url ?? null,
  };
}

/**
 * One concurrent payload for the logged-out homepage.
 *
 * Every query enforces public status/visibility explicitly — service-role
 * access is never the only gate. Supporting sections fail closed to empty
 * arrays; the Blog read is the one that may surface an error.
 */
export async function getPublicHomeServer(): Promise<PublicHomePayload> {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const postsPromise = supabaseAdmin
    .from("blog_posts")
    .select(PUBLIC_BLOG_COLS)
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(24);

  const collabsPromise = supabaseAdmin
    .from("collab_posts")
    .select(
      "id,slug,title,category,description,timeline_text,location_mode,status,ends_on,created_at," +
        "user:profiles!collab_posts_user_id_fkey(display_name,username)," +
        "city:cities!collab_posts_city_id_fkey(name)," +
        "roles:collab_roles(id,role_name,sort_order)",
    )
    .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(6);

  const groupsPromise = supabaseAdmin
    .from("groups")
    .select(
      "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,is_official,featured_at,category",
    )
    .is("deleted_at", null)
    .eq("visibility", "public")
    .order("featured_at", { ascending: false, nullsFirst: false })
    .order("member_count", { ascending: false })
    .limit(12);

  const worksPromise = supabaseAdmin
    .from("works")
    .select(
      "id,slug,title,category,cover_url,published_at,work_credits(sort_order,display_name,profiles(display_name,username))",
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .not("cover_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(16);

  const [postsRes, storiesRes, collabsRes, groupsRes, worksRes] = await Promise.all([
    postsPromise,
    listHomeWorkStoriesServer().catch(() => [] as HomeWorkStory[]),
    collabsPromise,
    groupsPromise,
    worksPromise,
  ]);

  if (postsRes.error) throw postsRes.error;
  const allPosts = ((postsRes.data ?? []) as unknown as PublicBlogRow[]).map(toPublicBlogCard);

  // Featured set: admin-selected, capped, newest first; newest post as fallback.
  const { data: featuredData, error: featuredErr } = await supabaseAdmin
    .from("blog_posts")
    .select(PUBLIC_BLOG_COLS)
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .eq("featured", true)
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(FEATURED_POST_CAP);
  if (featuredErr) throw featuredErr;

  const featuredRows = ((featuredData ?? []) as unknown as PublicBlogRow[]).map(toPublicBlogCard);
  const featuredIsFallback = featuredRows.length === 0;
  const featuredPosts = featuredIsFallback ? allPosts.slice(0, 1) : featuredRows;

  const seen = new Set(featuredPosts.map((p) => p.id));
  const latestPosts = allPosts.filter((p) => !seen.has(p.id)).slice(0, 6);
  for (const p of latestPosts) seen.add(p.id);
  const morePosts = allPosts.filter((p) => !seen.has(p.id)).slice(0, 6);

  type CollabRow = {
    id: string;
    slug: string;
    title: string;
    category: string;
    description: string | null;
    timeline_text: string | null;
    location_mode: string | null;
    user: { display_name: string | null; username: string | null } | null;
    city: { name: string | null } | null;
    roles: { id: string; role_name: string; sort_order: number | null }[] | null;
  };
  const openCollabs: PublicCollabCall[] = ((collabsRes.data ?? []) as unknown as CollabRow[])
    .slice(0, 3)
    .map((c) => {
      const roles = (c.roles ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((r) => r.role_name);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        category: c.category,
        description: c.description,
        creatorName: c.user?.display_name || c.user?.username || null,
        locationLabel:
          c.location_mode === "online"
            ? "Online"
            : (c.city?.name ?? (c.location_mode === "hybrid" ? "Hybrid" : "In person")),
        roles: roles.slice(0, 3),
        extraRoles: Math.max(0, roles.length - 3),
        timeline: c.timeline_text,
      };
    });

  type GroupRow = {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    kind: string | null;
    category: string | null;
    cover_url: string | null;
    avatar_url: string | null;
    accent_color: string | null;
    member_count: number | null;
    is_official: boolean | null;
  };
  const featuredGroups: PublicGroupScene[] = ((groupsRes.data ?? []) as unknown as GroupRow[])
    .slice(0, 3)
    .map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      tagline: g.tagline,
      kind: g.kind,
      category: g.category,
      coverUrl: g.cover_url,
      avatarUrl: g.avatar_url,
      accentColor: g.accent_color,
      memberCount: g.member_count ?? 0,
      isOfficial: !!g.is_official,
    }));

  type WorkRow = {
    id: string;
    slug: string;
    title: string;
    category: string;
    cover_url: string | null;
    work_credits?: {
      sort_order: number | null;
      display_name: string | null;
      profiles: { display_name: string | null; username: string | null } | null;
    }[];
  };
  const allWorkTiles = ((worksRes.data ?? []) as unknown as WorkRow[])
    .filter((w) => !!w.cover_url)
    .map((w) => {
      const credit = (w.work_credits ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
      return {
        id: w.id,
        slug: w.slug,
        title: w.title,
        category: w.category,
        coverUrl: w.cover_url as string,
        creditName:
          credit?.profiles?.display_name ||
          credit?.display_name ||
          credit?.profiles?.username ||
          null,
      };
    });
  const recentWorks = allWorkTiles.slice(0, 8);
  const visualWorks = allWorkTiles.slice(8, 11);

  return {
    featuredPosts,
    featuredIsFallback,
    latestPosts,
    morePosts,
    workStories: (storiesRes as HomeWorkStory[]).slice(0, 3),
    openCollabs,
    featuredGroups,
    recentWorks,
    visualWorks,
  };
}
