import { createFileRoute, notFound } from "@tanstack/react-router";

import type { BlogListItem } from "@/components/blog-featured-carousel";
import { BlogCategoryNav } from "@/components/blog/blog-category-nav";
import {
  BlogArchive,
  BlogLatestStories,
  BlogMoreStories,
  toBlogCard,
} from "@/components/blog/blog-editorial-sections";
import { PublicFeaturedStories } from "@/components/home/public-featured-stories";
import { getBlogCategory, isBlogCategorySlug, toBlogCategorySlug } from "@/lib/blog-categories";
import { listPublishedPosts } from "@/lib/blog.functions";

const SITE = "https://workshopindie.com";

export const Route = createFileRoute("/blog/c/$category")({
  loader: async ({ params }) => {
    if (!isBlogCategorySlug(params.category)) throw notFound();
    const all = (await listPublishedPosts()) as BlogListItem[];
    const posts = all.filter((p) => toBlogCategorySlug(p.category_slug) === params.category);
    return { posts, category: getBlogCategory(params.category) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Category not found — Workshop Blog" }, { name: "robots", content: "noindex" }],
      };
    }
    const { category } = loaderData;
    const title = `${category.label} — Workshop Blog`;
    const url = `${SITE}/blog/c/${category.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: category.description },
        { property: "og:title", content: title },
        { property: "og:description", content: category.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Workshop" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: category.description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogCategoryPage,
  notFoundComponent: CategoryNotFound,
});

function CategoryNotFound() {
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

function BlogCategoryPage() {
  const { posts, category } = Route.useLoaderData();

  const featured = posts.filter((p) => p.featured);
  const featuredIds = new Set(featured.map((p) => p.id));
  const cards = [...featured, ...posts.filter((p) => !featuredIds.has(p.id))].map(toBlogCard);

  return (
    <div className="pb-28 md:pb-16">
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Blog
          </p>
          <h1 className="mt-1.5 max-w-3xl font-display text-[28px] leading-[1.06] tracking-tight text-ink md:text-[42px]">
            {category.label}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {category.description}
          </p>
        </div>
      </section>

      <BlogCategoryNav active={category.slug} />

      {cards.length === 0 ? (
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:p-10">
            <div className="font-display text-xl text-ink">Nothing here yet.</div>
            <p className="mt-2 text-ink-muted">
              The first {category.label} story is still being written.
            </p>
          </div>
        </div>
      ) : (
        <>
          <PublicFeaturedStories posts={cards.slice(0, 3)} />
          <BlogLatestStories posts={cards.slice(3, 9)} />
          <BlogMoreStories posts={cards.slice(9, 15)} />
          <BlogArchive posts={cards.slice(15)} />
        </>
      )}
    </div>
  );
}
