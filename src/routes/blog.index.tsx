import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { BlogCategoryNav } from "@/components/blog/blog-category-nav";
import { BlogFeedList } from "@/components/blog/blog-feed-cards";
import { BlogFeedNav } from "@/components/blog/blog-feed-nav";
import { BlogMastheadActions } from "@/components/blog/blog-masthead-actions";
import { PublicFeaturedStories } from "@/components/home/public-featured-stories";
import { toBlogCard } from "@/components/blog/blog-editorial-sections";
import { useAuth } from "@/hooks/use-auth";
import { blogFeed, blogFeedPersonal } from "@/lib/topics.functions";
import { isBlogFeedTab, type BlogFeedRow, type BlogFeedTab } from "@/lib/blog-feed.server";
import { BLOG_STORY_TYPES } from "@/lib/blog-story-types";
import { MEDIUM_LIST } from "@/lib/topics/topics";
import type { BlogListItem } from "@/components/blog-featured-carousel";
import { workshopEntityUrl } from "@/lib/entities/kinds";

const SITE = "https://workshopindie.com";
const TITLE = "Workshop Blog — Creative Collaboration, Independent Art & Artist Portfolios";
const DESC =
  "Ideas, guides, and stories about finding collaborators, making independent creative work, and building a portfolio that shows how the work happened.";

type BlogSearch = {
  tab?: BlogFeedTab;
  topic?: string;
  medium?: string;
  type?: string;
};

function parseSearch(search: Record<string, unknown>): BlogSearch {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const tab = str(search.tab);
  return {
    tab: isBlogFeedTab(tab) ? tab : undefined,
    topic: str(search.topic),
    medium: str(search.medium),
    type: str(search.type),
  };
}


export const Route = createFileRoute("/blog/")({
  validateSearch: parseSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    // Public tabs render server-side; personalized tabs hydrate in the client
    // where the viewer's session (and therefore their follows) exists.
    const publicTab: BlogFeedTab =
      deps.tab === "for-you" || deps.tab === "following" ? "latest" : deps.tab;
    const [feed, featured] = await Promise.all([
      blogFeed({
        data: {
          tab: publicTab,
          topic: deps.topic ?? null,
          medium: deps.medium ?? null,
          postType: deps.type ?? null,
          limit: 24,
        },
      }),
      blogFeed({ data: { tab: "featured", limit: 6 } }),
    ]);
    return { feed, featured: featured.posts };
  },
  head: ({ loaderData }) => {
    const url = `${SITE}/blog`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESC },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESC },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Workshop" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESC },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "Workshop Blog",
            url,
            publisher: { "@type": "Organization", name: "Workshop", url: SITE },
            blogPost: (loaderData?.feed.posts ?? []).slice(0, 20).map((p) => ({
              "@type": "BlogPosting",
              headline: p.title,
              url: `${SITE}${workshopEntityUrl({ kind: "post", slug: p.slug })}`,
              datePublished: p.published_at,
            })),
          }),
        },
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">The Blog couldn't load.</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">Not found.</div>
  ),
  component: BlogIndexPage,
});

function Masthead() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 md:px-6 md:py-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Blog
          </p>
          <h1 className="mt-1.5 max-w-3xl font-display text-[28px] leading-[1.06] tracking-tight text-ink md:text-[42px]">
            Notes from Workshop
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {DESC}
          </p>
        </div>
        <BlogMastheadActions />
      </div>
    </section>
  );
}

const SELECT_CLASS =
  "h-8 rounded-full border border-border bg-surface px-3 text-[12px] text-ink-soft outline-none focus:border-ink/40";

/** Topic, Medium, and Post type. Scalable: options never depend on what loaded. */
function FeedFilters({
  search,
  topics,
  onChange,
}: {
  search: BlogSearch;
  topics: Array<{ slug: string; name: string }>;
  onChange: (next: Partial<BlogSearch>) => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <select
          aria-label="Filter by topic"
          className={SELECT_CLASS}
          value={search.topic ?? ""}
          onChange={(e) => onChange({ topic: e.target.value || undefined })}
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by medium"
          className={SELECT_CLASS}
          value={search.medium ?? ""}
          onChange={(e) => onChange({ medium: e.target.value || undefined })}
        >
          <option value="">All mediums</option>
          {MEDIUM_LIST.map((m) => (
            <option key={m.fieldId} value={m.fieldId}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by post type"
          className={SELECT_CLASS}
          value={search.type ?? ""}
          onChange={(e) => onChange({ type: e.target.value || undefined })}
        >
          <option value="">All post types</option>
          {BLOG_STORY_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {search.topic || search.medium || search.type ? (
          <button
            type="button"
            className="text-[12px] text-ink-muted underline"
            onClick={() => onChange({ topic: undefined, medium: undefined, type: undefined })}
          >
            Clear
          </button>
        ) : null}
        <div className="ml-auto flex gap-3 text-[12px] text-ink-muted">
          <Link to="/topics" className="underline hover:text-ink">
            All topics
          </Link>
          <Link to="/mediums" className="underline hover:text-ink">
            All mediums
          </Link>
        </div>
      </div>
    </div>
  );
}

function BlogIndexPage() {
  const { feed, featured } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const personalFeed = useServerFn(blogFeedPersonal);

  const personalized = search.tab === "for-you" || search.tab === "following";
  const [personalPosts, setPersonalPosts] = useState<BlogFeedRow[] | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  useEffect(() => {
    if (!personalized || !user) {
      setPersonalPosts(null);
      return;
    }
    let cancelled = false;
    setLoadingPersonal(true);
    void personalFeed({
      data: {
        tab: search.tab,
        topic: search.topic ?? null,
        medium: search.medium ?? null,
        postType: search.type ?? null,
        limit: 24,
      },
    })
      .then((res) => {
        if (!cancelled) setPersonalPosts(res.posts as BlogFeedRow[]);
      })
      .catch(() => {
        if (!cancelled) setPersonalPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPersonal(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalized, user, search.tab, search.topic, search.medium, search.type]);

  // Topic options come from the loaded feed plus whatever is filtered on, so the
  // control always shows a meaningful set without a second round trip.
  const topicOptions = new Map<string, string>();
  for (const p of [...feed.posts, ...featured]) {
    for (const t of p.topics ?? []) topicOptions.set(t.slug, t.name);
  }
  if (feed.topic) topicOptions.set(feed.topic.slug, feed.topic.name);
  const topics = [...topicOptions]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const showHero =
    search.tab === "latest" && !search.topic && !search.medium && !search.type && featured.length > 0;

  const posts = personalized ? (personalPosts ?? []) : feed.posts;

  return (
    <div className="pb-28 md:pb-16">
      <Masthead />
      <BlogFeedNav active={search.tab} search={{ topic: search.topic, medium: search.medium, type: search.type }} />
      <BlogCategoryNav active="all" />
      <FeedFilters
        search={search}
        topics={topics}
        onChange={(next) => navigate({ search: { ...search, ...next }, replace: true })}
      />

      {showHero ? (
        <PublicFeaturedStories posts={(featured as unknown as BlogListItem[]).map(toBlogCard)} />
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {personalized && !user ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:p-10">
            <div className="font-display text-xl text-ink">Sign in for a feed of your own.</div>
            <p className="mt-2 text-ink-muted">
              Follow topics, mediums, and writers, and this tab fills with what matters to you.
            </p>
            <Link
              to="/signup"
              className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-sm text-surface"
            >
              Join Workshop
            </Link>
          </div>
        ) : personalized && loadingPersonal && personalPosts === null ? (
          <div className="py-16 text-center text-ink-muted">Building your feed…</div>
        ) : (
          <BlogFeedList
            posts={posts}
            emptyTitle={
              search.tab === "following"
                ? "Nothing from what you follow yet."
                : "Nothing matches those filters."
            }
            emptyBody={
              search.tab === "following"
                ? "Follow a few topics and writers to fill this tab."
                : "Try clearing a filter, or browse all topics."
            }
          />
        )}
      </div>
    </div>
  );
}
