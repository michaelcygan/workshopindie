import { createFileRoute, notFound } from "@tanstack/react-router";

import type { BlogListItem } from "@/components/blog-featured-carousel";
import { BlogCategoryNav } from "@/components/blog/blog-category-nav";
import {
  BlogArchive,
  BlogLatestStories,
  BlogMoreStories,
  toBlogCard,
} from "@/components/blog/blog-editorial-sections";
import { BlogFilterBar } from "@/components/blog/blog-filter-bar";
import { PublicFeaturedStories } from "@/components/home/public-featured-stories";
import { listPostsBySection } from "@/lib/blog.functions";
import {
  applyBlogFilters,
  classifyBlogPosts,
  deriveBlogFilterOptions,
  parseBlogFilterSearch,
  type BlogFilterValue,
} from "@/lib/blog-filters";
import {
  getBlogSection,
  isBlogSectionId,
  type BlogSection,
} from "@/lib/blog-story-types";

const SITE = "https://workshopindie.com";

type Search = BlogFilterValue;

export const Route = createFileRoute("/blog/category/$category")({
  validateSearch: (search: Record<string, unknown>): Search => parseBlogFilterSearch(search),
  loader: async ({ params }) => {
    if (!isBlogSectionId(params.category)) throw notFound();
    const posts = (await listPostsBySection({
      data: { section: params.category },
    })) as BlogListItem[];
    return { posts, section: getBlogSection(params.category)! };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Category not found — Workshop Blog" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { section } = loaderData;
    const title = `${section.label} — Workshop Blog`;
    const url = `${SITE}/blog/category/${section.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: section.description },
        { property: "og:title", content: title },
        { property: "og:description", content: section.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Workshop" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: section.description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogSectionPage,
  notFoundComponent: SectionNotFound,
});

function SectionNotFound() {
  return (
    <div className="pb-28 md:pb-16">
      <BlogCategoryNav active="all" />
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <h1 className="font-display text-2xl text-ink">That category doesn't exist</h1>
        <p className="mt-2 text-ink-muted">Pick one from the list above.</p>
      </div>
    </div>
  );
}

function BlogSectionPage() {
  const { posts, section } = Route.useLoaderData() as {
    posts: BlogListItem[];
    section: BlogSection;
  };
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const classified = classifyBlogPosts(posts);
  const { fields: fieldOptions, subjects: subjectOptions } =
    deriveBlogFilterOptions(classified);
  const rows = applyBlogFilters(classified, search);

  const featured = rows.filter((p) => p.featured);
  const featuredIds = new Set(featured.map((p) => p.id));
  const cards = [...featured, ...rows.filter((p) => !featuredIds.has(p.id))].map(toBlogCard);

  const headerCount = Math.max(featured.length, Math.min(3, cards.length));
  const headerPosts = cards.slice(0, headerCount);
  const restCards = cards.slice(headerCount);

  return (
    <div className="pb-28 md:pb-16">
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Blog
          </p>
          <h1 className="mt-1.5 max-w-3xl font-display text-[28px] leading-[1.06] tracking-tight text-ink md:text-[42px]">
            {section.label}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {section.description}
          </p>
        </div>
      </section>

      <BlogCategoryNav active={section.id} />
      <BlogFilterBar
        fields={fieldOptions}
        subjects={subjectOptions}
        value={search}
        onChange={(next) => navigate({ search: next, replace: true })}
      />

      {cards.length === 0 ? (
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:p-10">
            <div className="font-display text-xl text-ink">Nothing here yet.</div>
            <p className="mt-2 text-ink-muted">Try clearing the filters or another category.</p>
          </div>
        </div>
      ) : (
        <>
          <PublicFeaturedStories posts={headerPosts} />
          <BlogLatestStories posts={restCards.slice(0, 6)} />
          <BlogMoreStories posts={restCards.slice(6, 12)} />
          <BlogArchive posts={restCards.slice(12)} />
        </>
      )}
    </div>
  );
}
