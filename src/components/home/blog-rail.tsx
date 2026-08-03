import { Link } from "@tanstack/react-router";
import type { HomeBlogCard } from "@/lib/home-types";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BlogRailCard({ post }: { post: HomeBlogCard }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group flex w-[74vw] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft sm:w-auto"
    >
      {post.coverUrl ? (
        <img
          src={post.coverUrl}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col justify-end gradient-motion p-4 opacity-85">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink/60">Workshop</span>
          <span className="line-clamp-3 font-display text-lg leading-snug text-ink/85">
            {post.title}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="line-clamp-2 font-display text-[15px] leading-snug text-ink group-hover:underline">
          {post.title}
        </span>
        {post.excerpt && <span className="line-clamp-2 text-xs text-ink-soft">{post.excerpt}</span>}
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-muted">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : null}
          <span className="truncate">{post.authorName}</span>
          {post.publishedAt && (
            <>
              <span aria-hidden className="text-ink-muted/60">
                ·
              </span>
              <span className="shrink-0">{formatDate(post.publishedAt)}</span>
            </>
          )}
        </span>
      </div>
    </Link>
  );
}

export function BlogRail({ posts }: { posts: HomeBlogCard[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {posts.map((p) => (
        <BlogRailCard key={p.id} post={p} />
      ))}
    </div>
  );
}
