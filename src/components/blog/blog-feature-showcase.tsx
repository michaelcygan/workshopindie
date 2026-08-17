import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import type { PublicBlogCard } from "@/lib/home-types";
import { formatShortDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const ROTATE_MS = 8000;

function Byline({ post, tone = "muted" }: { post: PublicBlogCard; tone?: "muted" | "ink" }) {
  return (
    <>
      {post.eyebrow ? (
        <p
          className={cn(
            "mt-2 text-[11px] uppercase tracking-[0.14em]",
            tone === "ink" ? "text-ink" : "text-ink-muted",
          )}
        >
          {post.eyebrow}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
        {post.authorName ? <>{post.authorName} · </> : null}
        {formatShortDate(post.publishedAt)}
      </p>
    </>
  );
}

function Cover({
  post,
  className,
  eager,
}: {
  post: PublicBlogCard;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={className}>
      {post.coverUrl ? (
        <img
          src={post.coverUrl}
          alt={post.coverAlt ?? post.title}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full bg-surface-2" />
      )}
    </div>
  );
}

/**
 * Big lead panel that rotates through the list beside it.
 * Desktop: lead + right-hand list. Mobile: swipeable snap carousel.
 */
export function BlogFeatureShowcase({ posts }: { posts: PublicBlogCard[] }) {
  const items = posts.slice(0, 24);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const programmatic = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? true), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const count = items.length;
  useEffect(() => {
    if (count < 2 || paused || !visible || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, visible, reduced]);

  // Keep the mobile carousel in sync with the active index.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index] as HTMLElement | undefined;
    if (!child) return;
    programmatic.current = true;
    track.scrollTo({ left: child.offsetLeft, behavior: reduced ? "auto" : "smooth" });
    const t = window.setTimeout(() => {
      programmatic.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [index, reduced]);

  const onTrackScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || programmatic.current) return;
    const next = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    setIndex((i) => (next !== i && next >= 0 && next < count ? next : i));
  }, [count]);

  if (count === 0) return null;
  const lead = items[index]!;

  return (
    <section
      ref={sectionRef}
      aria-label="Featured stories"
      className="mx-auto max-w-7xl border-b border-border px-4 py-6 md:px-6 md:py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Mobile: swipeable carousel */}
      <div className="md:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((p, i) => (
            <article key={p.id} className="group w-full shrink-0 snap-start">
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="block">
                <Cover
                  post={p}
                  eager={i === 0}
                  className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted"
                />
                <h3 className="mt-3 font-display text-[22px] leading-tight text-ink">{p.title}</h3>
                {p.excerpt ? (
                  <p className="mt-2 text-[14px] text-ink-soft line-clamp-2">{p.excerpt}</p>
                ) : null}
                <Byline post={p} />
              </Link>
            </article>
          ))}
        </div>
        {count > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {items.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show story ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-ink" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop: rotating lead + list */}
      <div className="hidden gap-8 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-10">
        <article className="group">
          <Link to="/blog/$slug" params={{ slug: lead.slug }} className="block">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
              {items.map((p, i) => (
                <div
                  key={p.id}
                  aria-hidden={i !== index}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500",
                    i === index ? "opacity-100" : "opacity-0",
                  )}
                >
                  <Cover post={p} eager={i === 0} className="h-full w-full" />
                </div>
              ))}
              {count > 1 && !reduced ? (
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/10">
                  <div
                    key={`${index}-${paused ? "p" : "r"}`}
                    className="h-full bg-ink/70"
                    style={{
                      animation: paused ? undefined : `blog-showcase-progress ${ROTATE_MS}ms linear forwards`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <h3 className="mt-4 font-display text-[24px] leading-tight text-ink transition-colors group-hover:text-primary md:text-[30px]">
              {lead.title}
            </h3>
            {lead.excerpt ? (
              <p className="mt-2 max-w-prose text-[15px] text-ink-soft line-clamp-3">
                {lead.excerpt}
              </p>
            ) : null}
            <Byline post={lead} tone="ink" />
          </Link>
        </article>

        <div className="divide-y divide-border/70 border-border/70 md:border-l md:pl-8">
          {items.map((p, i) => (
            <article
              key={p.id}
              className="group py-5 first:pt-0"
              onMouseEnter={() => setIndex(i)}
              onFocusCapture={() => setIndex(i)}
            >
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                aria-current={i === index ? "true" : undefined}
                className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-4"
              >
                <div
                  className={cn(
                    "min-w-0 border-l-2 pl-3 transition-colors",
                    i === index ? "border-ink" : "border-transparent",
                  )}
                >
                  <h3
                    className={cn(
                      "font-display text-[17px] leading-snug transition-colors group-hover:text-primary",
                      i === index ? "text-ink" : "text-ink-soft",
                    )}
                  >
                    {p.title}
                  </h3>
                  <Byline post={p} />
                </div>
                <Cover
                  post={p}
                  className="aspect-square w-[88px] shrink-0 overflow-hidden rounded-md bg-muted"
                />
              </Link>
            </article>
          ))}
        </div>
      </div>

      <style>{`@keyframes blog-showcase-progress { from { width: 0% } to { width: 100% } }`}</style>
    </section>
  );
}
