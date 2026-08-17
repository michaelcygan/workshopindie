/**
 * Editorial typeahead for the Blog index: type, see matching stories, hit
 * Enter or click to open one. Purely a jump-to-post control — the Topic and
 * Medium pills own filtering.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";

import { blogEyebrowText } from "@/lib/blog-form";
import { formatShortDate } from "@/lib/format-date";
import { searchBlogPosts, type BlogSearchHit } from "@/lib/blog-search.functions";

export function BlogSearch() {
  const navigate = useNavigate();
  const run = useServerFn(searchBlogPosts);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<BlogSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = window.setTimeout(() => {
      void run({ data: { q: term, limit: 8 } })
        .then((res) => {
          if (cancelled) return;
          setHits(res);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (hit: BlogSearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ("");
    void navigate({ to: "/blog/$slug", params: { slug: hit.slug } });
  };

  const showPanel = open && term.length >= 2;
  const empty = useMemo(() => showPanel && !loading && hits.length === 0, [showPanel, loading, hits]);

  return (
    <div ref={rootRef} className="relative w-full md:max-w-md">
      <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 transition-colors focus-within:border-ink/50">
        <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(hits[active] ?? hits[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search stories"
          aria-label="Search stories"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="blog-search-results"
          className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              setHits([]);
            }}
            className="shrink-0 rounded-full p-0.5 text-ink-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          id="blog-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          {loading && hits.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-muted">Searching…</p>
          ) : empty ? (
            <p className="px-4 py-3 text-[13px] text-ink-muted">No stories match “{term}”.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {hits.map((hit, i) => {
                const eyebrow = blogEyebrowText(hit);
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                      className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 ${
                        i === active ? "bg-muted/60" : ""
                      }`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                        {hit.cover_image_url ? (
                          <img
                            src={hit.cover_image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[14px] text-ink">
                          {hit.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
                          {eyebrow ? <>{eyebrow} · </> : null}
                          {formatShortDate(hit.published_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
