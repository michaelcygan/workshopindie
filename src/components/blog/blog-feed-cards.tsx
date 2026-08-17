import { Link } from "@tanstack/react-router";

import { TopicChips } from "@/components/topics/topic-chips";
import { blogEyebrowText } from "@/lib/blog-form";
import { formatShortDate } from "@/lib/format-date";
import type { BlogFeedRow } from "@/lib/blog-feed.server";

/** One feed row: cover thumb, eyebrow, title, dek, byline, Topic chips. */
export function BlogFeedCard({ post }: { post: BlogFeedRow }) {
  const eyebrow = blogEyebrowText(post);
  const author = post.author_profile?.display_name || post.author_name;
  return (
    <article className="group grid grid-cols-[minmax(0,1fr)_96px] gap-4 border-b border-border py-5 md:grid-cols-[minmax(0,1fr)_180px] md:gap-8 md:py-7">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</p>
        ) : null}
        <h3 className="mt-1.5 font-display text-[19px] leading-tight text-ink md:text-[24px]">
          <Link to="/blog/$slug" params={{ slug: post.slug }} className="hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-soft md:text-[15px]">
          {post.excerpt}
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
          {author ? <>{author} · </> : null}
          {formatShortDate(post.published_at)}
        </p>
        <TopicChips topics={post.topics} className="mt-3" />
      </div>
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        className="block aspect-square overflow-hidden rounded-md bg-surface-2 md:aspect-[16/10]"
        aria-hidden
        tabIndex={-1}
      >
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt ?? ""}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
      </Link>
    </article>
  );
}

export function BlogFeedList({
  posts,
  emptyTitle = "Nothing here yet.",
  emptyBody = "Try another tab or clear a filter.",
}: {
  posts: BlogFeedRow[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:p-10">
        <div className="font-display text-xl text-ink">{emptyTitle}</div>
        <p className="mt-2 text-ink-muted">{emptyBody}</p>
      </div>
    );
  }
  return (
    <div>
      {posts.map((p) => (
        <BlogFeedCard key={p.id} post={p} />
      ))}
    </div>
  );
}
