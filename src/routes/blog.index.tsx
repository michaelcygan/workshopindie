import { createFileRoute } from "@tanstack/react-router";
import { listPublishedPosts } from "@/lib/blog.functions";
import type { BlogListItem } from "@/components/blog-featured-carousel";
import { PublicFeaturedStories } from "@/components/home/public-featured-stories";
import { BlogCategoryNav } from "@/components/blog/blog-category-nav";
import { BlogMastheadActions } from "@/components/blog/blog-masthead-actions";
import {
  BlogArchive,
  BlogLatestStories,
  BlogMoreStories,
  toBlogCard,
} from "@/components/blog/blog-editorial-sections";
import { workshopEntityUrl } from "@/lib/entities/kinds";

const SITE = "https://workshopindie.com";
const TITLE = "Workshop Blog — Creative Collaboration, Independent Art & Artist Portfolios";
const DESC = "Ideas, guides, and stories about finding collaborators, making independent creative work, and building a portfolio that shows how the work happened.";


export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const posts = await listPublishedPosts();
    return { posts };
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
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Workshop Blog",
          url,
          publisher: { "@type": "Organization", name: "Workshop", url: SITE },
          blogPost: (loaderData?.posts ?? []).slice(0, 20).map((p: { title: string; slug: string; published_at: string | null }) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE}${workshopEntityUrl({ kind: "post", slug: p.slug })}`,
            datePublished: p.published_at,
          })),
        }),
      }],
    };
  },
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
            Ideas, guides, and stories about finding collaborators, making independent creative
            work, and building a portfolio that shows how the work happened.
          </p>
        </div>
        <BlogMastheadActions />
      </div>
    </section>
  );
}

function BlogIndexPage() {
  const { posts } = Route.useLoaderData() as { posts: BlogListItem[] };

  // Featured leads, topped up from the newest posts — same rule as the homepage.
  const featured = posts.filter((p) => p.featured);
  const featuredIds = new Set(featured.map((p) => p.id));
  const ordered = [...featured, ...posts.filter((p) => !featuredIds.has(p.id))];

  const cards = ordered.map(toBlogCard);
  // The whole featured set rotates through the lead slot; when nothing is
  // featured, the three newest posts stand in.
  const headerCount = Math.max(featured.length, Math.min(3, cards.length));
  const headerPosts = cards.slice(0, headerCount);
  const restCards = cards.slice(headerCount);
  const latestPosts = restCards.slice(0, 6);
  const morePosts = restCards.slice(6, 12);
  const archivePosts = restCards.slice(12);

  return (
    <div className="pb-28 md:pb-16">
      <Masthead />
      <BlogCategoryNav active="all" />

      {posts.length === 0 ? (
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:p-10">
            <div className="font-display text-xl text-ink">Nothing published yet.</div>
            <p className="mt-2 text-ink-muted">
              The first notes are being written. Come back soon.
            </p>
          </div>
        </div>
      ) : (
        <>
          <PublicFeaturedStories posts={headerPosts} />
          <BlogLatestStories posts={latestPosts} />
          <BlogMoreStories posts={morePosts} />
          <BlogArchive posts={archivePosts} />
        </>
      )}
    </div>
  );
}
