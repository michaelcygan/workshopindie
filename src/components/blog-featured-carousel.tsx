import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";

export type BlogAuthorProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
} | null;

export type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  updated_at: string;
  featured?: boolean | null;
  publication_type?: string | null;
  author_profile?: BlogAuthorProfile;
};

export function formatBlogDate(value: string | null, long = false) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, long
    ? { year: "numeric", month: "long", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function authorOf(p: BlogListItem) {
  const profile = p.author_profile ?? null;
  return {
    name: profile?.display_name || p.author_name,
    avatar: profile?.avatar_url ?? null,
  };
}

export function Byline({ post, className = "" }: { post: BlogListItem; className?: string }) {
  const author = authorOf(post);
  return (
    <div className={`flex min-w-0 items-center gap-2 text-xs text-ink-muted ${className}`}>
      {author.avatar ? (
        <img
          src={author.avatar}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-muted" aria-hidden />
      )}
      <span className="truncate">{author.name}</span>
      {post.published_at && (
        <>
          <span aria-hidden className="text-ink-muted/60">·</span>
          <span className="shrink-0">{formatBlogDate(post.published_at)}</span>
        </>
      )}
    </div>
  );
}

export function FeaturedHero({ post, inCarousel = false }: { post: BlogListItem; inCarousel?: boolean }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className={`group block overflow-hidden rounded-3xl border border-border bg-surface hover:bg-muted ${
        inCarousel ? "h-full" : "mt-6 md:mt-10"
      }`}
    >
      <div className="grid h-full gap-0 md:grid-cols-2">
        <div className="relative">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? post.title}
              className="aspect-[16/10] w-full object-cover md:aspect-auto md:h-full"
            />
          ) : (
            <div className="aspect-[16/10] w-full bg-secondary md:aspect-auto md:h-full" />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-ink backdrop-blur">
            Featured
          </span>
        </div>
        <div className="p-5 md:p-10">
          <h2 className="font-display text-2xl leading-tight text-ink group-hover:underline md:text-3xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-soft md:mt-3 md:line-clamp-3 md:text-base">
              {post.excerpt}
            </p>
          )}
          <Byline post={post} className="mt-3" />
        </div>
      </div>
    </Link>
  );
}

const INTERVAL_MS = 7000;

export function BlogFeaturedCarousel({ posts }: { posts: BlogListItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = posts.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (paused || interacting || reduceMotion || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, interacting, reduceMotion, count]);

  useEffect(() => {
    const onVisibility = () => setInteracting(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured posts"
      className="relative mt-6 md:mt-10"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={() => setInteracting(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
        setInteracting(true);
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        if (start != null && end != null && Math.abs(end - start) > 48) {
          go(index + (end < start ? 1 : -1));
        }
        touchStartX.current = null;
        setInteracting(false);
      }}
    >
      <div className="overflow-hidden rounded-3xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {posts.map((p, i) => (
            <div
              key={p.id}
              className="w-full shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${p.title}`}
              aria-hidden={i !== index}
              {...(i !== index ? { inert: "" as unknown as boolean } : {})}
            >
              <FeaturedHero post={p} inCarousel />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? "Play featured posts" : "Pause featured posts"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-ink-muted hover:text-ink"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <div className="flex items-center gap-2">
          {posts.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show featured post ${i + 1}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-ink" : "w-2 bg-border hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
