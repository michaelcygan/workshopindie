import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HomeBlogCard } from "@/lib/home-types";

const INTERVAL_MS = 8000;

function greetingFor(name: string | null) {
  const hour = new Date().getHours();
  const g =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  return name ? `${g}, ${name}` : g;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Slide({ post }: { post: HomeBlogCard }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group flex min-h-[132px] w-full shrink-0 snap-start items-stretch gap-3 md:gap-5"
    >
      <div className="w-[36%] shrink-0 overflow-hidden rounded-2xl border border-border bg-surface sm:w-[34%] md:w-[30%]">
        {post.coverUrl ? (
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-secondary p-2 opacity-80">
            <span className="font-display text-[11px] uppercase tracking-widest text-ink/70">
              Workshop
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h2 className="line-clamp-2 font-display text-[19px] leading-snug text-ink group-hover:underline md:text-2xl">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft md:text-sm">
            {post.excerpt}
          </p>
        )}
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-ink-muted">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
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
        </div>
      </div>
    </Link>
  );
}

/**
 * Compact member-home header: a greeting plus the admin-featured Blog set.
 * Same `featured` flag that drives /blog — no parallel editorial model.
 */
export function HomeFeaturedBlog({
  greetingName,
  posts,
  isFallback,
}: {
  greetingName: string | null;
  posts: HomeBlogCard[];
  isFallback: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = posts.length;
  const go = useCallback(
    (next: number) => setIndex(count ? ((next % count) + count) % count : 0),
    [count],
  );

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

  const greeting = greetingFor(greetingName);

  if (count === 0) {
    return (
      <header className="mx-auto max-w-7xl px-4 pb-4 pt-6 md:px-6 md:pt-8">
        <h1 className="font-display text-2xl leading-tight text-ink md:text-3xl">{greeting}.</h1>
      </header>
    );
  }

  const multi = count > 1;

  return (
    <header
      className="mx-auto max-w-7xl px-4 pb-4 pt-5 md:px-6 md:pt-8"
      aria-roledescription={multi ? "carousel" : undefined}
      aria-label={multi ? "Featured Blog posts" : undefined}
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
        if (multi && start != null && end != null && Math.abs(end - start) > 48) {
          go(index + (end < start ? 1 : -1));
        }
        touchStartX.current = null;
        setInteracting(false);
      }}
    >
      <p className="font-display text-lg leading-tight text-ink md:text-xl">{greeting}.</p>

      <div className="mt-2 rounded-3xl border border-border bg-surface p-3 md:p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {isFallback ? "Latest from the Blog" : "Featured from the Blog"}
          </span>
          {multi && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setPaused(true);
                  go(index - 1);
                }}
                aria-label="Previous featured post"
                className="grid h-11 w-11 place-items-center text-ink-muted transition hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured posts">
                {posts.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Featured post ${i + 1} of ${count}`}
                    onClick={() => {
                      setPaused(true);
                      go(i);
                    }}
                    className="grid h-11 w-4 place-items-center"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-4 bg-ink" : "w-1.5 bg-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaused(true);
                  go(index + 1);
                }}
                aria-label="Next featured post"
                className="grid h-11 w-11 place-items-center text-ink-muted transition hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 overflow-hidden">
          <div
            className={`flex ${reduceMotion ? "" : "transition-transform duration-500 ease-out"}`}
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {posts.map((p, i) => (
              <div
                key={p.id}
                className="w-full shrink-0"
                role="group"
                aria-roledescription={multi ? "slide" : undefined}
                aria-hidden={i !== index}
                {...(i !== index ? { inert: "" as unknown as boolean } : {})}
              >
                <Slide post={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
