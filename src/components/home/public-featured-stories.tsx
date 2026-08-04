import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicBlogCard } from "@/lib/home-types";
import { cn } from "@/lib/utils";

const ROTATE_MS = 7500;

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The lead editorial feature: one admin-featured Blog story at a time.
 *
 * Motion is restrained and always yields to the reader — auto-advance pauses
 * on hover, focus, pointer interaction, hidden tabs, and reduced-motion.
 */
export function PublicFeaturedStories({ posts }: { posts: PublicBlogCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const count = posts.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused || reduced.current) return;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => go(1), ROTATE_MS);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count, paused, go]);

  if (count === 0) return null;
  const post = posts[Math.min(index, count - 1)]!;

  return (
    <section
      aria-label="Featured story"
      className="border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={() => setPaused(true)}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="mb-4 flex items-center justify-between gap-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Featured story
            {count > 1 ? (
              <span className="ml-2 tabular-nums text-ink-soft">
                {index + 1} / {count}
              </span>
            ) : null}
          </p>
          {count > 1 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous featured story"
                className="grid h-11 w-11 place-items-center rounded-full border border-border text-ink-soft transition hover:bg-muted hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next featured story"
                className="grid h-11 w-11 place-items-center rounded-full border border-border text-ink-soft transition hover:bg-muted hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="group grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-10"
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted">
            {post.coverUrl ? (
              <img
                src={post.coverUrl}
                alt={post.coverAlt ?? post.title}
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center border border-border bg-surface p-6">
                <span className="font-display text-2xl italic text-ink-soft">Workshop</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[28px] leading-[1.12] text-ink transition-colors group-hover:text-primary md:text-[42px]">
              {post.title}
            </h2>
            {post.excerpt ? (
              <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft line-clamp-4">
                {post.excerpt}
              </p>
            ) : null}
            <p className="mt-4 text-[12px] uppercase tracking-[0.1em] text-ink-muted">
              {post.authorName ? <>{post.authorName} · </> : null}
              {formatDate(post.publishedAt)}
            </p>
          </div>
        </Link>

        {count > 1 ? (
          <div className="mt-5 flex gap-1.5" role="tablist" aria-label="Featured stories">
            {posts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show story ${i + 1}: ${p.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1 w-8 rounded-full transition",
                  i === index ? "bg-ink" : "bg-border hover:bg-ink-muted",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
