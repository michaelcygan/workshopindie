/**
 * Client-safe view models for the homepage.
 *
 * Home is a presentation/orchestration layer over the existing product graph —
 * these types are a stable contract so the server-side scorer can be replaced
 * later without touching the UI.
 */

export type HomeStoryLabel = "process" | "workshop" | "story";

export type HomeStoryCredit = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role_label: string | null;
};

export type HomeStoryPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  label: HomeStoryLabel;
  authors: HomeStoryCredit[];
  author_name: string | null;
};

/** One public Work + the trusted Blog stories written about it. */
export type HomeWorkStory = {
  work: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    cover_focal_x: number | null;
    cover_focal_y: number | null;
    categories: string[];
    published_at: string | null;
  };
  credits: HomeStoryCredit[];
  stories: HomeStoryPost[];
  storyCount: number;
};

export const HOME_STORY_LABEL_TEXT: Record<HomeStoryLabel, string> = {
  process: "Process note",
  workshop: "From Workshop",
  story: "Story about this Work",
};

// ─────────────────────────── Member home ───────────────────────────

export type HomeTodaySummary = {
  groupId: string;
  groupSlug: string;
  groupName: string;
  groupAvatar: string | null;
  postCount: number;
  latestBody: string | null;
  latestAuthor: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  latestAt: string | null;
};

export type HomeLounge = {
  roomId: string;
  title: string;
  medium: string | null;
  groupId: string;
  groupName: string;
  groupSlug: string;
  liveCount: number;
  avatars: string[];
};

export type HomeEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  locationMode: string | null;
  venueName: string | null;
  cityName: string | null;
  coverUrl: string | null;
  groupSlug: string;
  groupName: string;
  rsvped: boolean;
  reason: "rsvp" | "group" | "city" | "online";
};

export type HomeContinueKind =
  | "blog_draft"
  | "collab_applicants"
  | "work_needs_story"
  | "introduce_in_today"
  | "upcoming_rsvp"
  | "complete_profile"
  | "first_work";

export type HomeContinueAction = {
  kind: HomeContinueKind;
  title: string;
  detail: string | null;
  actionLabel: string;
  /** Route + params for the primary action. `workId` seeds a pre-tagged draft. */
  to: string | null;
  params?: Record<string, string>;
  workId?: string;
  coverUrl?: string | null;
};

export type HomeGroupSuggestion = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  memberCount: number;
  reason: string;
};

export type HomeCircleReason =
  | "follow"
  | "collaborator"
  | "group"
  | "city"
  | "medium"
  | "collab"
  | "work";

export type HomeCircleStory = {
  id: string;
  kind: "work" | "blog" | "collab" | "event";
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  occurredAt: string | null;
  reason: HomeCircleReason;
  reasonText: string;
  to: string;
  params: Record<string, string>;
  people: HomeStoryCredit[];
};

export type HomePersonSuggestion = {
  id: string;
  username: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  mediums: string[];
  reasonText: string;
};

export type HomeDisciplineItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  coverUrl: string | null;
  excerpt: string | null;
  embedUrl: string | null;
  sourceType: string | null;
  bridge: string | null;
};

/** A Blog post rendered as a card (featured header + "From the Blog" rail). */
export type HomeBlogCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  categorySlug: string | null;
  publishedAt: string | null;
  authorName: string | null;
  authorAvatar: string | null;
};

export type HomeMineKind = "work" | "credited_work" | "blog" | "collab";

/** Something the signed-in member made or is credited on. */
export type HomeMineItem = {
  id: string;
  kind: HomeMineKind;
  label: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  focalX: number | null;
  focalY: number | null;
  to: string;
  params: Record<string, string>;
  occurredAt: string | null;
};

export type MemberHomePayload = {
  greetingName: string | null;
  coverUrl: string | null;
  coverWork: { slug: string; title: string } | null;
  today: HomeTodaySummary[];
  lounges: HomeLounge[];
  loungeFallbackGroup: { slug: string; name: string } | null;
  nextEvent: HomeEvent | null;
  continueActions: HomeContinueAction[];
  groupSuggestions: HomeGroupSuggestion[];
  circle: HomeCircleStory[];
  people: HomePersonSuggestion[];
  disciplines: HomeDisciplineItem[];
  hasEligibleWorkToWriteAbout: boolean;
  /** Up to 5 admin-featured Blog posts; falls back to the newest indexed post. */
  featuredPosts: HomeBlogCard[];
  featuredIsFallback: boolean;
  /** The member's own recent Works / stories / Collabs. */
  mine: HomeMineItem[];
  /** Recent public Blog posts, excluding whatever the header already shows. */
  blogRail: HomeBlogCard[];
  /** The viewer's home city, when set on their profile. */
  homeCity: { id: string; name: string; slug: string | null } | null;
  /** A public Group representing that city, when one exists. */
  homeCityGroup: { id: string; name: string; slug: string } | null;
  /** The Groups the viewer belongs to (id/name/slug only). */
  nowGroups: Array<{ id: string; name: string; slug: string }>;
  /** The viewer's declared mediums. */
  mediums: string[];
  /** Several ranked upcoming Events; `nextEvent` is the first of these. */
  upcomingEvents: HomeEvent[];
};

// ─────────────────────── Public (logged-out) home ───────────────────────

/** A Blog post as the public homepage renders it. */
export type PublicBlogCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  categorySlug: string | null;
  publishedAt: string | null;
  authorName: string | null;
  authorAvatar: string | null;
};

/** An open Collab rendered as a type-led "open call". */
export type PublicCollabCall = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string | null;
  creatorName: string | null;
  locationLabel: string;
  roles: string[];
  extraRoles: number;
  timeline: string | null;
};

/** A public Group rendered as a creative scene. */
export type PublicGroupScene = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: string | null;
  category: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  memberCount: number;
  isOfficial: boolean;
};

/** A published public Work with real cover imagery. */
export type PublicWorkTile = {
  id: string;
  slug: string;
  title: string;
  category: string;
  coverUrl: string;
  creditName: string | null;
};

export type PublicHomePayload = {
  /** Up to 5 admin-featured posts; newest first. */
  featuredPosts: PublicBlogCard[];
  featuredIsFallback: boolean;
  /** Six recent posts not already featured. */
  latestPosts: PublicBlogCard[];
  /** Next 4–6 posts not shown above. */
  morePosts: PublicBlogCard[];
  workStories: HomeWorkStory[];
  openCollabs: PublicCollabCall[];
  featuredGroups: PublicGroupScene[];
  /** Recent published Works for the public homepage carousel. */
  recentWorks: PublicWorkTile[];
  visualWorks: PublicWorkTile[];
};
