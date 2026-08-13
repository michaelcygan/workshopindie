import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PublicBlogCard } from "@/lib/home-types";
import { formatLongDate as formatDate } from "@/lib/format-date";

const ROTATE_MIN_MS = 6500;
const ROTATE_MAX_MS = 10000;
const randomHold = () =>
  Math.round(ROTATE_MIN_MS + Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS));

/**
 * The lead editorial block: one large feature plus two compact secondary
 * stories. The whole featured set takes turns being the lead with a gentle
 * crossfade on an ambient, slightly irregular cadence — pausing on
 * hover/focus, off-screen, hidden tab, or reduced motion.
 */

export function PublicFeaturedStories({ posts }: { posts: PublicBlogCard[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leadIndex, setLeadIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  const count = posts.length;
  const canRotate = count >= 2 && !reduced;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(!!entries[0]?.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Each hold is a fresh random duration, so the cadence never feels metered.
  const [holdMs, setHoldMs] = useState(ROTATE_MIN_MS);
  useEffect(() => {
    if (!canRotate || paused || !visible) return;
    const ms = randomHold();
    setHoldMs(ms);
    const id = window.setTimeout(() => setLeadIndex((i) => (i + 1) % count), ms);
    return () => window.clearTimeout(id);
  }, [canRotate, paused, visible, count, leadIndex]);

  if (count === 0) return null;

  const ordered = posts.map((_, i) => posts[(leadIndex + i) % count]!);
  const lead = ordered[0]!;
  const rest = ordered.slice(1, 3);
  // Mount only the outgoing, current and incoming slides: an unlimited
  // featured set shouldn't stack dozens of hero images on top of each other,
  // but the previous lead has to stay around long enough to fade out.
  const slideWindow = [posts[(leadIndex - 1 + count) % count]!, lead, ordered[1 % count]!];
  const slides = slideWindow.filter((p, i) => slideWindow.findIndex((q) => q.id === p.id) === i);

  return (
    <section aria-label="Featured stories" className="border-b border-border">
      <div
        ref={containerRef}
        className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Featured story
        </p>
        <div className="mb-3 h-px w-full overflow-hidden bg-border/60">
          {canRotate && !paused && visible ? (
            <div
              key={`${lead.id}-${paused}-${visible}`}
              className="h-px bg-primary/20 animate-[featured-progress_linear_forwards]"
              style={{ animationDuration: `${holdMs}ms` }}
            />
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10">
          <Link
            to="/blog/$slug"
            params={{ slug: lead.slug }}
            className="group block"
            aria-label={lead.title}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted">
              {slides.map((post, i) => (
                <div
                  key={post.id}
                  aria-hidden={i !== 0}
                  className="absolute inset-0 transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.33,0,0.2,1)] motion-reduce:transition-none"
                  style={{
                    opacity: i === 0 ? 1 : 0,
                    transform: i === 0 ? "translateY(0)" : "translateY(4px)",
                    pointerEvents: i === 0 ? "auto" : "none",
                  }}
                >
                  {post.coverUrl ? (
                    <img
                      src={post.coverUrl}
                      alt={i === 0 ? (post.coverAlt ?? post.title) : ""}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center border border-border bg-surface p-6">
                      <span className="font-display text-2xl italic text-ink-soft">Workshop</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Link>

          <div className="min-w-0">
            <Link
              key={lead.id}
              to="/blog/$slug"
              params={{ slug: lead.slug }}
              className="group block animate-[featured-rise_600ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
            >
              <h2 className="font-display text-[26px] leading-[1.12] text-ink transition-colors group-hover:text-primary md:text-[38px]">
                {lead.title}
              </h2>
              {lead.excerpt ? (
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft line-clamp-3">
                  {lead.excerpt}
                </p>
              ) : null}
              <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-ink-muted">
                {lead.authorName ? <>{lead.authorName} · </> : null}
                {formatDate(lead.publishedAt)}
              </p>
            </Link>

            {rest.length > 0 ? (
              <div className="mt-5 border-t border-border">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-border py-3 transition hover:bg-muted/40 animate-[featured-rise_600ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
                  >
                    <div className="aspect-square w-[72px] overflow-hidden rounded-md bg-muted">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt={post.coverAlt ?? post.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center border border-border bg-surface">
                          <span className="font-display text-sm italic text-ink-soft">W/</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-[16px] leading-snug text-ink transition-colors group-hover:text-primary line-clamp-2 md:text-[18px]">
                        {post.title}
                      </h3>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                        {formatDate(post.publishedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
