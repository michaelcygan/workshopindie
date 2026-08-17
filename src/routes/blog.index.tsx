import { createFileRoute, Link } from "@tanstack/react-router";

import { BlogMastheadActions } from "@/components/blog/blog-masthead-actions";
import { BlogSearch } from "@/components/blog/blog-search";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterSelect,
} from "@/components/filter-header";
import { BlogFeatureShowcase } from "@/components/blog/blog-feature-showcase";

import {
  BlogArchive,
  BlogLatestStories,
  BlogMoreStories,
  toBlogCard,
} from "@/components/blog/blog-editorial-sections";
import { blogFeed } from "@/lib/topics.functions";
import { MEDIUM_LIST } from "@/lib/topics/topics";
import type { BlogListItem } from "@/components/blog-featured-carousel";
import { workshopEntityUrl } from "@/lib/entities/kinds";

const SITE = "https://workshopindie.com";
const TITLE = "Workshop Blog — Creative Collaboration, Independent Art & Artist Portfolios";
const DESC =
  "Ideas, guides, and stories about finding collaborators, making independent creative work, and building a portfolio that shows how the work happened.";

type BlogSearchParams = { topic?: string; medium?: string };

function parseSearch(search: Record<string, unknown>): BlogSearchParams {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return { topic: str(search.topic), medium: str(search.medium) };
}

export const Route = createFileRoute("/blog/")({
  validateSearch: parseSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [feed, featured] = await Promise.all([
      blogFeed({
        data: {
          tab: "latest",
          topic: deps.topic ?? null,
          medium: deps.medium ?? null,
          limit: 60,
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
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-6 px-4 py-4 md:px-6 md:py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Blog
          </p>
          <h1 className="mt-1 max-w-3xl font-display text-[28px] leading-[1.06] tracking-tight text-ink md:text-[42px]">
            Notes from Workshop
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {DESC}
          </p>
        </div>
        <BlogMastheadActions />
      </div>
    </section>
  );
}

/** Search on the left, Topic · Medium · clear on the right. */
function ControlRow({
  search,
  topics,
  onChange,
}: {
  search: BlogSearchParams;
  topics: Array<{ slug: string; name: string }>;
  onChange: (next: Partial<BlogSearchParams>) => void;
}) {
  const active = !!(search.topic || search.medium);
  return (
    <FilterHeader>
      <BlogSearch />
      <FilterControls>
        <FilterSelect
          label="Filter by topic"
          value={search.topic ?? ""}
          onChange={(v) => onChange({ topic: v || undefined })}
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filter by medium"
          value={search.medium ?? ""}
          onChange={(v) => onChange({ medium: v || undefined })}
        >
          <option value="">All mediums</option>
          {MEDIUM_LIST.map((m) => (
            <option key={m.fieldId} value={m.fieldId}>
              {m.label}
            </option>
          ))}
        </FilterSelect>
        {active ? (
          <FilterClear onClick={() => onChange({ topic: undefined, medium: undefined })} />
        ) : null}
      </FilterControls>
    </FilterHeader>
  );
}

function BlogIndexPage() {
  const { feed, featured } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const topicOptions = new Map<string, string>();
  for (const p of [...feed.posts, ...featured]) {
    for (const t of p.topics ?? []) topicOptions.set(t.slug, t.name);
  }
  if (feed.topic) topicOptions.set(feed.topic.slug, feed.topic.name);
  const topics = [...topicOptions]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filtered = !!(search.topic || search.medium);
  const cards = (feed.posts as unknown as BlogListItem[]).map(toBlogCard);
  const featuredCards = (featured as unknown as BlogListItem[]).map(toBlogCard);

  // Featured picks drive the showcase and are contained there; otherwise the
  // showcase rotates the latest posts, which still continue down the page.
  const usesFeatured = !filtered && featuredCards.length > 0;
  const showcase = filtered ? [] : usesFeatured ? featuredCards : cards.slice(0, 6);
  const featuredIds = new Set(usesFeatured ? featuredCards.map((p) => p.id) : []);
  const rest = cards.filter((c) => !featuredIds.has(c.id));

  const latest = filtered || usesFeatured ? rest.slice(0, 6) : [];
  const more = rest.slice(latest.length ? 6 : 0, 18);
  const archive = rest.slice(18);

  return (
    <div className="pb-28 md:pb-16">
      <Masthead />

      <ControlRow
        search={search}
        topics={topics}
        onChange={(next) => navigate({ search: { ...search, ...next }, replace: true })}
      />

      {showcase.length > 0 ? <BlogFeatureShowcase posts={showcase} /> : null}


      {cards.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <p className="font-display text-xl text-ink">Nothing matches those filters.</p>
          <p className="mt-2 text-ink-muted">
            Try clearing a filter, or browse{" "}
            <Link to="/topics" className="underline hover:text-ink">
              all topics
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <BlogLatestStories posts={latest} />
          <BlogMoreStories posts={more} />
          <BlogArchive posts={archive} />
        </>
      )}
    </div>
  );
}
