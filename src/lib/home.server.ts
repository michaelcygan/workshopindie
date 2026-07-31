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

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  HomeCircleStory,
  HomeContinueAction,
  HomeDisciplineItem,
  HomeEvent,
  HomeGroupSuggestion,
  HomeLounge,
  HomePersonSuggestion,
  HomeStoryCredit,
  HomeStoryLabel,
  HomeTodaySummary,
  HomeWorkStory,
  MemberHomePayload,
} from "@/lib/home-types";

const POST_SCAN_LIMIT = 40;
const MAX_WORK_STORIES = 8;
const MAX_STORIES_PER_WORK = 3;

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
  return out.sort((a, b) => b.postCount - a.postCount).slice(0, 4);
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

/** One upcoming Event: RSVPed > joined Group > home city > online. */
export async function nextEventServer(
  userId: string,
  groups: MyGroup[],
  homeCityId: string | null,
): Promise<HomeEvent | null> {
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

  async function fetchEvents(
    apply: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>,
  ) {
    const { data } = await apply(baseQuery());
    return (data ?? []) as unknown as Row[];
  }
  function baseQuery() {
    return supabaseAdmin
      .from("group_events")
      .select(EVENT_SELECT)
      .gt("starts_at", nowIso)
      .is("deleted_at", null)
      .in("visibility", ["public", "group_only"])
      .order("starts_at", { ascending: true })
      .limit(5);
  }

  const groupIds = groups.map((g) => g.id);
  const candidates: Array<{ row: Row; reason: HomeEvent["reason"]; rsvped: boolean }> = [];

  if (rsvpIds.length) {
    for (const row of await fetchEvents((q) => q.in("id", rsvpIds))) {
      candidates.push({ row, reason: "rsvp", rsvped: true });
    }
  }
  if (!candidates.length && groupIds.length) {
    for (const row of await fetchEvents((q) => q.in("group_id", groupIds))) {
      candidates.push({ row, reason: "group", rsvped: false });
    }
  }
  if (!candidates.length && homeCityId) {
    for (const row of await fetchEvents((q) => q.eq("venue_city_id", homeCityId))) {
      candidates.push({ row, reason: "city", rsvped: false });
    }
  }
  if (!candidates.length) {
    for (const row of await fetchEvents((q) => q.eq("format", "online"))) {
      candidates.push({ row, reason: "online", rsvped: false });
    }
  }
  if (!candidates.length) return null;

  const pick = candidates[0];
  const [{ data: group }, { data: city }] = await Promise.all([
    supabaseAdmin.from("groups").select("slug,name").eq("id", pick.row.group_id).maybeSingle(),
    pick.row.venue_city_id
      ? supabaseAdmin.from("cities").select("name").eq("id", pick.row.venue_city_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const g = group as { slug: string; name: string } | null;
  if (!g) return null;

  return {
    id: pick.row.id,
    slug: pick.row.slug,
    title: pick.row.title,
    startsAt: pick.row.starts_at,
    locationMode: pick.row.format,
    venueName: pick.row.venue_name,
    cityName: (city as { name: string } | null)?.name ?? null,
    coverUrl: pick.row.cover_url,
    groupSlug: g.slug,
    groupName: g.name,
    rsvped: pick.rsvped,
    reason: pick.reason,
  };
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
      .select("id,title,updated_at")
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
      .eq("status", "open")
      .limit(10),
    supabaseAdmin
      .from("profiles")
      .select("headline,bio,avatar_url,mediums")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const draft = ((draftsRes.data ?? []) as Array<{ id: string; title: string }>)[0];
  if (draft) {
    actions.push({
      kind: "blog_draft",
      title: draft.title?.trim() || "Untitled draft",
      detail: "Pick up where you left off.",
      actionLabel: "Continue writing",
      to: "/me/blog/$id",
      params: { id: draft.id },
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
          .eq("status", "open")
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

  const [loungesR, eventR, continueR, suggestR, circleR, peopleR, disciplineR, coverWorkR] =
    await Promise.allSettled([
      myGroupLoungesServer(groups),
      nextEventServer(userId, groups, homeCityId),
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
    ]);

  const lounges = loungesR.status === "fulfilled" ? loungesR.value : [];
  const cont =
    continueR.status === "fulfilled" ? continueR.value : { actions: [], hasEligibleWork: false };

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
    nextEvent: eventR.status === "fulfilled" ? eventR.value : null,
    continueActions: cont.actions,
    groupSuggestions: suggestR.status === "fulfilled" ? suggestR.value : [],
    circle: circleR.status === "fulfilled" ? circleR.value : [],
    people: peopleR.status === "fulfilled" ? peopleR.value : [],
    disciplines: disciplineR.status === "fulfilled" ? disciplineR.value : [],
    hasEligibleWorkToWriteAbout: cont.hasEligibleWork,
  };
}
