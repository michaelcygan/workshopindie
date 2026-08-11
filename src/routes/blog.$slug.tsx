import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublishedPost } from "@/lib/blog.functions";
import { BlogPostBody } from "@/components/blog-post-body";
import { BlogArticleFooter } from "@/components/blog-article-footer";
import { BlogPostContext } from "@/components/blog-post-context";
import { BlogComments } from "@/components/blog-comments";
import { BlogAuthorActions } from "@/components/blog/blog-author-actions";
import { deriveBlogPostContext, contextMentions } from "@/lib/blog-post-context";
import { blogStoryTypeLabel } from "@/lib/blog-story-types";
import { getBlogCategory } from "@/lib/blog-categories";
import type { BlogEntityTag } from "@/lib/blog-entity-tags";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Link2, Flag } from "lucide-react";
import { shareImage, shareImageMeta } from "@/lib/og-image";
import { workshopEntityUrl } from "@/lib/entities/kinds";


const SITE = "https://workshopindie.com";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found — Workshop" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.post;
    const title = (p.seo_title?.trim() || p.title).slice(0, 80);
    const description = (p.seo_description?.trim() || p.excerpt || "").slice(0, 200);
    const url = `${SITE}${workshopEntityUrl({ kind: "post", slug: params.slug })}`;
    // Crawlers only render raster images, so share the post's own cover file.
    const img = shareImage(p.cover_image_url);
    const hidden = p.show_in_blog_index === false;
    const meta: Array<Record<string, string>> = [
      { title: `${title} — Workshop` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Workshop" },
      ...shareImageMeta(p.cover_image_url, p.cover_image_alt ?? title),
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "article:published_time", content: p.published_at ?? "" },
      { property: "article:modified_time", content: p.updated_at ?? "" },
    ];
    if (hidden) meta.push({ name: "robots", content: "noindex, follow" });

    const authors = (p.authors ?? []) as Array<{ username: string | null; display_name: string | null; role_label: string | null }>;
    const primaryAuthorNode =
      authors.length > 0
        ? authors.map((a) =>
            a.username
              ? { "@type": "Person", name: a.display_name || a.username, url: `${SITE}/${a.username}` }
              : { "@type": "Person", name: a.display_name || p.author_name || "Workshop" },
          )
        : p.author_profile?.username
          ? {
              "@type": "Person",
              name: p.author_name || p.author_profile.display_name || p.author_profile.username,
              url: `${SITE}/${p.author_profile.username}`,
            }
          : { "@type": "Organization", name: p.author_name || "Workshop" };
    return {
      meta,
      links: [
        { rel: "canonical", href: url },
        ...(img ? [{ rel: "preload", as: "image", href: img, fetchpriority: "high" }] : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: p.title,
            description,
            image: img ? [img] : undefined,
            datePublished: p.published_at,
            dateModified: p.updated_at,
            author: primaryAuthorNode,
            publisher: {
              "@type": "Organization",
              name: "Workshop",
              logo: { "@type": "ImageObject", url: `${SITE}/favicon.png` },
            },
            mainEntityOfPage: url,
            url,
            mentions: contextMentions(
              deriveBlogPostContext({
                categorySlug: p.category_slug,
                tags: (p.entity_tags ?? []) as BlogEntityTag[],
                authorProfileIds: authors.map((a) => (a as { id?: string }).id),
                authorUsernames: [
                  ...authors.map((a) => a.username),
                  p.author_profile?.username ?? null,
                ],
              }),
              SITE,
            ),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Workshop", item: SITE },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
              { "@type": "ListItem", position: 3, name: p.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  const entityTags = (post.entity_tags ?? []) as BlogEntityTag[];
  const authors = (post.authors ?? []) as Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    role_label: string | null;
  }>;
  const context = deriveBlogPostContext({
    categorySlug: post.category_slug,
    tags: entityTags,
    authorProfileIds: authors.map((a) => a.id),
    authorUsernames: [...authors.map((a) => a.username), post.author_profile?.username ?? null],
  });
  const category = getBlogCategory(post.category_slug);
  const storyTypeLabel = blogStoryTypeLabel(post.story_type);

  const publishedAt = post.published_at ? new Date(post.published_at) : null;
  const updatedAt = post.updated_at ? new Date(post.updated_at) : null;
  const meaningfullyUpdated =
    publishedAt && updatedAt && updatedAt.getTime() - publishedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-14">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to Blog
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          {storyTypeLabel && (
            <>
              <span className="text-ink">{storyTypeLabel}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <Link
            to="/blog/c/$category"
            params={{ category: category.slug }}
            className="hover:text-ink"
          >
            {category.label}
          </Link>
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">{post.title}</h1>
        <div className="mt-4 text-sm text-ink-muted">
          By{" "}
          {post.authors && post.authors.length > 0 ? (
            post.authors.map((a: { id: string; username: string | null; display_name: string | null; role_label: string | null }, i: number) => (
              <span key={a.id}>
                {a.username ? (
                  <Link
                    to="/$username"
                    params={{ username: a.username }}
                    search={{ tab: "blog" as const }}
                    className="font-medium text-ink underline decoration-border underline-offset-4 hover:decoration-primary"
                  >
                    {a.display_name || a.username}
                  </Link>
                ) : (
                  <span className="text-ink">{a.display_name}</span>
                )}
                {a.role_label ? <span className="text-ink-muted"> · {a.role_label}</span> : null}
                {i < post.authors!.length - 1 ? <span>, </span> : null}
              </span>
            ))
          ) : post.author_profile?.username ? (
            <Link
              to="/$username"
              params={{ username: post.author_profile.username }}
              className="font-medium text-ink underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              {post.author_name || post.author_profile.display_name || post.author_profile.username}
            </Link>
          ) : (
            post.author_name || "Workshop"
          )}
          {publishedAt && (
            <>
              {" · "}
              {publishedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </>
          )}
          {meaningfullyUpdated && (
            <>
              {" · Updated "}
              {updatedAt!.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </>
          )}
          <BlogAuthorActions
            postId={post.id}
            createdBy={(post as { created_by?: string | null }).created_by ?? null}
            authorProfileId={(post as { author_profile_id?: string | null }).author_profile_id ?? null}
          />
        </div>
      </header>

      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? post.title}
          fetchPriority="high"
          decoding="async"
          className="mt-8 w-full rounded-xl border border-border object-cover"
        />
      )}

      <div className="mt-8">
        <BlogPostBody markdown={post.body_markdown} />
      </div>

      <BlogPostContext context={context} className="mt-12 md:mt-14" />


      <ShareRow slug={post.slug} title={post.title} postId={post.id} />

      <BlogArticleFooter postId={post.id} mode="article" section="related" />

      <BlogComments
        postId={post.id}
        authorProfileIds={[
          (post as { created_by?: string | null }).created_by ?? null,
          (post as { author_profile_id?: string | null }).author_profile_id ?? null,
          ...authors.map((a) => a.id),
        ]}
      />

      <BlogArticleFooter postId={post.id} mode="article" section="cta" />

    </article>
  );
}

function ShareRow({ slug, title, postId }: { slug: string; title: string; postId: string }) {
  const url = `${SITE}${workshopEntityUrl({ kind: "post", slug: slug })}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }
  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title, url });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copy();
  }
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-md gap-1.5" onClick={share}>
          <Link2 className="h-4 w-4" /> Share
        </Button>
      </div>
      <ReportDialog
        entityType="blog_post"
        entityId={postId}
        trigger={
          <Button variant="ghost" size="sm" className="rounded-md gap-1.5 text-ink-muted hover:text-ink">
            <Flag className="h-4 w-4" /> Report
          </Button>
        }
      />
    </div>
  );
}

