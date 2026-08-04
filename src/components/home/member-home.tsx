import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Calendar, Compass, PenLine, Radio, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeSection } from "@/components/home-section";
import { WorkStoriesCarousel } from "@/components/home/work-stories-carousel";
import { HomeFeaturedBlog } from "@/components/home/home-featured-blog";
import { NowModule } from "@/components/home/now-module";
import { NowBoardDesktop } from "@/components/home/now-board-desktop";
import { YourWorkshop } from "@/components/home/your-workshop";
import { BlogRail } from "@/components/home/blog-rail";
import { getMemberHome } from "@/lib/home.functions";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { HomeCircleStory, MemberHomePayload } from "@/lib/home-types";

function categoryLabel(id: string) {
  return (
    (CATEGORY_LABELS as Record<string, string>)[id] ??
    id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ")
  );
}

/* ──────────────────────────── Circles ──────────────────────────── */

const CIRCLE_ICON: Record<HomeCircleStory["kind"], typeof Radio> = {
  work: Sparkles,
  blog: BookOpen,
  collab: Users,
  event: Calendar,
};

function CircleCard({ item }: { item: HomeCircleStory }) {
  const Icon = CIRCLE_ICON[item.kind];
  return (
    <Link
      to={item.to as never}
      params={item.params as never}
      className="group flex w-[74vw] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft sm:w-[300px]"
    >
      {item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="aspect-[16/10] w-full bg-secondary opacity-60" />
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
          <Icon className="h-3 w-3" />
          {item.reasonText}
        </span>
        <span className="font-display text-base leading-snug text-ink group-hover:underline">
          {item.title}
        </span>
        {item.subtitle && (
          <span className="line-clamp-2 text-xs text-ink-soft">{item.subtitle}</span>
        )}
      </div>
    </Link>
  );
}

/* ──────────────────────────── Member home ──────────────────────────── */

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-36 rounded-xl" />
      <Skeleton className="mt-6 h-40 rounded-xl" />
    </div>
  );
}

export function MemberHome() {
  const fetchHome = useServerFn(getMemberHome);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["member-home"],
    queryFn: () => fetchHome(),
    staleTime: 45_000,
    // The board claims to be live, so it has to actually refresh — but only
    // while the tab is in front of the member.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Realtime nudge, heavily debounced: bursts of Today posts collapse into one
  // refetch rather than one per row.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!document.hidden) qc.invalidateQueries({ queryKey: ["member-home"] });
      }, 8_000);
    };
    const channel = supabase
      .channel("member-home-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_today_posts" }, bump)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (q.isLoading || !q.data) return <HomeSkeleton />;
  const data = q.data as MemberHomePayload;

  return (
    <div className="pb-28">
      <HomeFeaturedBlog
        greetingName={data.greetingName}
        posts={data.featuredPosts}
        isFallback={data.featuredIsFallback}
      />

      {/* Now — departures board on desktop, compact module on small screens. */}
      <div className="hidden px-4 pt-6 lg:block">
        <NowBoardDesktop data={data} />
      </div>
      <div className="lg:hidden">
        <HomeSection title="Now" divider={false} tone="quiet" density="compact">
          <NowModule
            today={data.today}
            lounges={data.lounges}
            fallbackGroup={data.loungeFallbackGroup}
            nextEvent={data.nextEvent}
          />
        </HomeSection>
      </div>

      <HomeSection
        eyebrow="Yours"
        title="Your Workshop"
        kicker="What you've made and what's still open."
        density="compact"
        tone="quiet"
      >
        <YourWorkshop mine={data.mine} actions={data.continueActions} />
      </HomeSection>

      {data.blogRail.length > 0 && (
        <HomeSection
          eyebrow="Reading"
          title="From the Blog"
          href="/blog"
          cta="Open Blog"
          density="compact"
        >
          <BlogRail posts={data.blogRail} />
          <div className="mt-3">
            <Button asChild variant="outline" size="sm" className="rounded-md gap-1.5">
              <Link to="/me/blog">
                <PenLine className="h-3.5 w-3.5" /> Write a story
              </Link>
            </Button>
          </div>
        </HomeSection>
      )}

      <WorkStoriesCarousel />

      {data.circle.length > 0 && (
        <HomeSection
          eyebrow="Your circles"
          title="Around you"
          kicker="People you follow, collaborators you've been credited with, and your Groups."
          density="compact"
        >
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {data.circle.map((item) => (
              <CircleCard key={item.id} item={item} />
            ))}
          </div>
        </HomeSection>
      )}

      {data.groupSuggestions.length > 0 && (
        <HomeSection
          eyebrow="Start somewhere"
          title="Groups to join"
          href="/groups"
          cta="All Groups"
          tone="quiet"
          density="compact"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {data.groupSuggestions.map((g) => (
              <Link
                key={g.id}
                to="/g/$slug"
                params={{ slug: g.slug }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-ink/20"
              >
                <Avatar className="h-10 w-10">
                  {g.avatarUrl ? <AvatarImage src={g.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{g.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-display text-base text-ink group-hover:underline">
                    {g.name}
                  </div>
                  <div className="truncate text-xs text-ink-muted">
                    {g.reason} · {g.memberCount} members
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </HomeSection>
      )}

      {data.people.length > 0 && (
        <HomeSection
          eyebrow="Worth knowing"
          title="People in your orbit"
          tone="quiet"
          density="compact"
        >
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {data.people.map((p) => (
              <Link
                key={p.id}
                to="/u/$username"
                params={{ username: p.username }}
                className="group flex w-56 shrink-0 snap-start flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 transition hover:border-ink/20"
              >
                <Avatar className="h-10 w-10">
                  {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                  <AvatarFallback>
                    {(p.displayName || p.username).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-display text-base text-ink group-hover:underline">
                    {p.displayName || p.username}
                  </div>
                  {p.headline && (
                    <div className="line-clamp-2 text-xs text-ink-soft">{p.headline}</div>
                  )}
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-muted">
                    {p.reasonText}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </HomeSection>
      )}

      {data.disciplines.length > 0 && (
        <HomeSection
          eyebrow="Look sideways"
          title="Across disciplines"
          kicker="One Work from each medium moving on Workshop this week."
          href="/gallery"
          cta="Open Gallery"
          density="compact"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.disciplines.map((d) => (
              <Link
                key={d.id}
                to="/works/$slug"
                params={{ slug: d.slug }}
                className="group overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft"
              >
                {d.coverUrl ? (
                  <img
                    src={d.coverUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="aspect-[16/10] w-full bg-secondary opacity-60" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
                    <Compass className="h-3 w-3" />
                    {categoryLabel(d.category)}
                    {d.bridge && <span className="text-ink-soft">· {d.bridge}</span>}
                  </div>
                  <div className="mt-1 font-display text-lg leading-snug text-ink group-hover:underline">
                    {d.title}
                  </div>
                  {d.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{d.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </HomeSection>
      )}

      <HomeSection
        eyebrow="Make something"
        title="Start a new thing"
        divider
        tone="quiet"
        density="compact"
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-md gap-1.5">
            <Link to="/works/new">
              <Sparkles className="h-4 w-4" /> Post a Work
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full gap-1.5">
            <Link to="/collab/new">
              <Users className="h-4 w-4" /> Post a Collab
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full gap-1.5">
            <Link to="/me/blog">
              <PenLine className="h-4 w-4" /> Write a story
            </Link>
          </Button>
        </div>
      </HomeSection>
    </div>
  );
}
