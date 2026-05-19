import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { CategoryScroller } from "@/components/category-scroller";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listFollowingWorks,
  PROVIDER_OPTIONS,
  PROVIDER_PATTERNS,
} from "@/lib/gallery.functions";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  tab: fallback(z.enum(["for-you", "following"]), "for-you").default("for-you"),
  cat: fallback(z.string(), "all").default("all"),
  src: fallback(z.string(), "all").default("all"),
  sort: fallback(z.enum(["recent", "trending"]), "recent").default("recent"),
});

export const Route = createFileRoute("/gallery")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Gallery — Workshop" },
      { name: "description", content: "Browse everything people have shipped on Workshop. Filter by medium, source, and what your network is making." },
      { property: "og:title", content: "Gallery — Workshop" },
      { property: "og:description", content: "Browse everything people have shipped on Workshop." },
    ],
  }),
  component: GalleryPage,
});

const PAGE_SIZE = 30;

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function fetchForYouPage(params: {
  category: string;
  provider: string;
  sort: "recent" | "trending";
  q: string;
  cursor: string | null;
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  let qb = supabase
    .from("works")
    .select(
      "id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at, work_credits(role_label, sort_order, profiles(id,display_name,username))",
    )
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(PAGE_SIZE);

  if (params.category !== "all") qb = qb.eq("category", params.category as Category);
  if (params.q.trim()) {
    const s = params.q.trim().replace(/[%,]/g, " ");
    qb = qb.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`);
  }
  if (params.provider !== "all") {
    if (params.provider === "other") {
      qb = qb.is("embed_url", null);
    } else {
      const patterns = PROVIDER_PATTERNS[params.provider];
      if (patterns?.length) {
        qb = qb.or(patterns.map((p) => `embed_url.ilike.%${p}%`).join(","));
      }
    }
  }
  if (params.sort === "recent") {
    qb = qb
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (params.cursor) qb = qb.lt("published_at", params.cursor);
  } else {
    qb = qb
      .order("popularity_score", { ascending: false })
      .order("like_count", { ascending: false });
  }

  const { data, error } = await qb;
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    published_at: string | null;
    work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  const works = (data as Row[]).map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
  }));
  const last = (data as Row[])[(data as Row[]).length - 1];
  const nextCursor =
    params.sort === "recent" && works.length === PAGE_SIZE && last?.published_at
      ? last.published_at
      : null;
  return { works, nextCursor };
}

function GalleryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gallery" });
  const { user } = useAuth();
  const [qInput, setQInput] = useState(search.q);
  const qDebounced = useDebounced(qInput, 250);

  // Push debounced search to URL
  useEffect(() => {
    if (qDebounced !== search.q) {
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, q: qDebounced }), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const tab = search.tab;
  const category = search.cat;
  const provider = search.src;
  const sort = search.sort;
  const q = search.q;

  const queryKey = useMemo(
    () => ["gallery", tab, category, provider, sort, q, user?.id ?? null],
    [tab, category, provider, sort, q, user?.id],
  );

  const queryResult = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled: tab === "for-you" || !!user,
    queryFn: async ({ pageParam }) => {
      if (tab === "following") {
        return await listFollowingWorks({
          data: {
            limit: PAGE_SIZE,
            cursor: pageParam,
            category,
            provider,
            sort,
            q,
          },
        });
      }
      return fetchForYouPage({ category, provider, sort, q, cursor: pageParam });
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const pages = queryResult.data?.pages ?? [];
  const works = pages.flatMap((p) => p.works);
  const isLoading = queryResult.isLoading;
  const isFetchingNext = queryResult.isFetchingNextPage;
  const hasNext = queryResult.hasNextPage;
  const fetchNext = queryResult.fetchNextPage;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNext) fetchNext();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, isFetchingNext, fetchNext]);

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }), replace: true });

  const categoryTabs: { id: string; label: string }[] = [
    { id: "all", label: "All" },
    ...WORK_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  const filtersActive =
    category !== "all" || provider !== "all" || sort !== "recent" || q.trim().length > 0;

  return (
    <main>
      {/* Slim header */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <h1 className="font-display text-3xl text-ink md:text-4xl">Gallery</h1>
          <p className="mt-1 text-sm text-ink-muted">Everything people have shipped — film, music, writing, build, visuals.</p>
        </div>
      </section>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur md:top-14">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          {/* Row 1: search + sort + tabs */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search works by title or description…"
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {qInput && (
                <button
                  onClick={() => setQInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Tabs */}
              <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
                <button
                  onClick={() => setSearch({ tab: "for-you" })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition",
                    tab === "for-you" ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  For you
                </button>
                <button
                  onClick={() => {
                    if (!user) {
                      navigate({ to: "/login" });
                      return;
                    }
                    setSearch({ tab: "following" });
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition",
                    tab === "following" ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  Following
                </button>
              </div>

              {/* Sort */}
              <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
                {(["recent", "trending"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSearch({ sort: s })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm capitalize transition",
                      sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: category chips */}
          <div className="mt-3">
            <CategoryScroller
              tabs={categoryTabs}
              value={category}
              onChange={(v) => setSearch({ cat: v })}
            />
          </div>

          {/* Row 3: provider chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="px-1 text-ink-muted">Source:</span>
            {PROVIDER_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSearch({ src: p.id })}
                className={cn(
                  "rounded-full border px-2.5 py-1 transition",
                  provider === p.id
                    ? "border-ink bg-ink text-background"
                    : "border-border bg-surface text-ink-soft hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            ))}
            {filtersActive && (
              <button
                onClick={() => {
                  setQInput("");
                  navigate({
                    search: { q: "", tab, cat: "all", src: "all", sort: "recent" },
                    replace: true,
                  });
                }}
                className="ml-auto rounded-full px-2.5 py-1 text-ink-muted hover:text-ink"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {tab === "following" && !user ? (
          <EmptyState
            title="Sign in to see your Following feed"
            body="Follow people, then come back here to see what they're making."
            cta={<Link to="/login"><Button className="rounded-full">Sign in</Button></Link>}
          />
        ) : isLoading ? (
          <Grid>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </Grid>
        ) : works.length === 0 ? (
          tab === "following" ? (
            <EmptyState
              title="Your Following feed is empty"
              body="Follow people on their profiles to fill this up."
              cta={
                <Button onClick={() => setSearch({ tab: "for-you" })} className="rounded-full">
                  Browse For you
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No works match those filters"
              body="Try clearing filters or a different search."
              cta={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQInput("");
                    navigate({
                      search: { q: "", tab, cat: "all", src: "all", sort: "recent" },
                      replace: true,
                    });
                  }}
                  className="rounded-full"
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <>
            <Grid>
              {works.map((w) => <WorkCard key={w.id} work={w} />)}
            </Grid>
            <div ref={sentinelRef} className="h-12" />
            {isFetchingNext && (
              <Grid>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
                ))}
              </Grid>
            )}
            {!hasNext && works.length > PAGE_SIZE && (
              <p className="mt-8 text-center text-xs text-ink-muted">You've reached the end.</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && <div className="mt-5 inline-block">{cta}</div>}
    </div>
  );
}
