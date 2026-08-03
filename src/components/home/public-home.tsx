import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHome } from "@/lib/home.functions";
import { PublicFeaturedStories } from "@/components/home/public-featured-stories";
import {
  PublicLatestStories,
  PublicMoreStories,
} from "@/components/home/public-latest-stories";
import { PublicOpenCollabs } from "@/components/home/public-open-collabs";
import { PublicWorkStories } from "@/components/home/public-work-stories";
import { PublicGroupScenes } from "@/components/home/public-group-scenes";
import { PublicWorkStrip } from "@/components/home/public-work-strip";

/**
 * The logged-out front door: an independent editorial publication that
 * happens to contain a creative network.
 *
 * Blog leads; Collabs and Groups are woven in as evidence that Workshop is a
 * place, not just a magazine. One `getPublicHome` request feeds every section.
 */
export function PublicHome() {
  const fetchHome = useServerFn(getPublicHome);
  const { data, isLoading } = useQuery({
    queryKey: ["public-home"],
    queryFn: () => fetchHome(),
    staleTime: 3 * 60_000,
  });

  return (
    <>
      <Masthead />
      {isLoading && !data ? (
        <HomeSkeleton />
      ) : data ? (
        <>
          <PublicFeaturedStories posts={data.featuredPosts} />
          <PublicLatestStories posts={data.latestPosts} />
          <PublicOpenCollabs collabs={data.openCollabs} />
          <PublicWorkStories stories={data.workStories} />
          <PublicGroupScenes groups={data.featuredGroups} />
          <PublicMoreStories posts={data.morePosts} />
          <PublicWorkStrip works={data.visualWorks} />
        </>
      ) : null}
    </>
  );
}

function Masthead() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-ink-muted">
          Workshop
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-[32px] leading-[1.08] tracking-tight text-ink md:text-[52px]">
          Independent culture, made together.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Read stories from independent creators, discover the Work behind them, find open
          Collabs, and join Groups where creative communities gather.
        </p>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12" aria-hidden>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
        <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-muted" />
        <div className="space-y-3">
          <div className="h-8 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-12 grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="aspect-[16/10] w-full animate-pulse rounded-lg bg-muted" />
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_88px] gap-4">
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
              <div className="aspect-square w-[88px] animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
