import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  MapPin,
  MessageSquare,
  PenLine,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeSection } from "@/components/home-section";
import { WorkStoriesCarousel } from "@/components/home/work-stories-carousel";
import { getMemberHome } from "@/lib/home.functions";
import { createMyBlogDraft } from "@/lib/blog-member.functions";
import { CATEGORY_LABELS } from "@/lib/categories";
import type {
  HomeCircleStory,
  HomeContinueAction,
  HomeEvent,
  HomeLounge,
  HomeTodaySummary,
  MemberHomePayload,
} from "@/lib/home-types";

function categoryLabel(id: string) {
  return (
    (CATEGORY_LABELS as Record<string, string>)[id] ??
    id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ")
  );
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "starting soon";
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/* ─────────────────────────── Atmosphere header ─────────────────────────── */

function AtmosphereHeader({ data }: { data: MemberHomePayload }) {
  const name = data.greetingName;
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  return (
    <header className="relative overflow-hidden border-b border-border/60">
      {data.coverUrl ? (
        <>
          <img src={data.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-canvas/80 backdrop-blur-[2px]" />
        </>
      ) : (
        <div className="absolute inset-0 gradient-motion opacity-[0.12]" />
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Workshop</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-5xl">
          {greeting}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft md:text-base">
          Here's what's moving in your corner of the network right now.
        </p>
        {data.coverWork && (
          <Link
            to="/works/$slug"
            params={{ slug: data.coverWork.slug }}
            className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-muted hover:text-ink"
          >
            Backdrop: {data.coverWork.title} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </header>
  );
}

/* ──────────────────────────────── Now ──────────────────────────────── */

function NowCard({
  icon: Icon,
  eyebrow,
  children,
}: {
  icon: typeof Radio;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
        <Icon className="h-3.5 w-3.5" />
        {eyebrow}
      </span>
      {children}
    </div>
  );
}

function TodaySlot({ today }: { today: HomeTodaySummary[] }) {
  const top = today[0];
  return (
    <NowCard icon={MessageSquare} eyebrow="Today">
      {top ? (
        <>
          <Link
            to="/g/$slug"
            params={{ slug: top.groupSlug }}
            className="font-display text-lg text-ink hover:underline"
          >
            {top.groupName}
          </Link>
          <p className="line-clamp-2 text-sm text-ink-soft">
            {top.latestAuthor && (
              <span className="text-ink">
                {top.latestAuthor.display_name || top.latestAuthor.username}:{" "}
              </span>
            )}
            {top.latestBody}
          </p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {today.slice(1, 3).map((t) => (
              <Link
                key={t.groupId}
                to="/g/$slug"
                params={{ slug: t.groupSlug }}
                className="rounded-full border border-border px-3 py-1 text-xs text-ink-soft hover:border-ink/20 hover:text-ink"
              >
                {t.groupName} · {t.postCount}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Today's boards are quiet. Be the first voice.</p>
          <Button asChild variant="outline" size="sm" className="mt-auto w-fit rounded-full">
            <Link to="/groups">Find a Group</Link>
          </Button>
        </>
      )}
    </NowCard>
  );
}

function LoungeSlot({
  lounges,
  fallbackGroup,
}: {
  lounges: HomeLounge[];
  fallbackGroup: MemberHomePayload["loungeFallbackGroup"];
}) {
  const top = lounges[0];
  return (
    <NowCard icon={Radio} eyebrow={top ? "Live now" : "Lounge"}>
      {top ? (
        <>
          <Link
            to="/lounge/$id"
            params={{ id: top.roomId }}
            className="font-display text-lg text-ink hover:underline"
          >
            {top.title}
          </Link>
          <p className="text-sm text-ink-soft">
            {top.liveCount} {top.liveCount === 1 ? "person" : "people"} in {top.groupName}
          </p>
          <div className="mt-auto flex -space-x-2">
            {top.avatars.map((a) => (
              <Avatar key={a} className="h-6 w-6 border border-surface">
                <AvatarImage src={a} alt="" />
                <AvatarFallback className="text-[9px]">·</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            No one's talking yet{fallbackGroup ? ` in ${fallbackGroup.name}` : ""}. Open a room and
            see who joins.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-auto w-fit rounded-full">
            <Link to="/lounge">Open a Lounge</Link>
          </Button>
        </>
      )}
    </NowCard>
  );
}

function EventSlot({ event }: { event: HomeEvent | null }) {
  return (
    <NowCard icon={Calendar} eyebrow={event?.rsvped ? "You're going" : "Next up"}>
      {event ? (
        <>
          <Link
            to="/g/$slug/e/$eventSlug"
            params={{ slug: event.groupSlug, eventSlug: event.slug }}
            className="font-display text-lg leading-snug text-ink hover:underline"
          >
            {event.title}
          </Link>
          <p className="text-sm text-ink-soft">
            {timeUntil(event.startsAt)}
            {event.venueName
              ? ` · ${event.venueName}`
              : event.cityName
                ? ` · ${event.cityName}`
                : ""}
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-xs text-ink-muted">
            <MapPin className="h-3 w-3" /> {event.groupName}
          </span>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Nothing on your calendar yet.</p>
          <Button asChild variant="outline" size="sm" className="mt-auto w-fit rounded-full">
            <Link to="/events">Browse Events</Link>
          </Button>
        </>
      )}
    </NowCard>
  );
}

/* ───────────────────────── Continue making ───────────────────────── */

function ContinueCard({ action }: { action: HomeContinueAction }) {
  const navigate = useNavigate();
  const createFn = useServerFn(createMyBlogDraft);
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { seedTag: { kind: "work", id: action.workId! } } }),
    onSuccess: (res: { id: string }) => navigate({ to: "/me/blog/$id", params: { id: res.id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const body = (
    <>
      <div className="min-w-0">
        <div className="font-display text-base leading-snug text-ink">{action.title}</div>
        {action.detail && <p className="mt-0.5 text-sm text-ink-soft">{action.detail}</p>}
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs text-ink-soft group-hover:text-ink">
        {action.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </>
  );

  const cls =
    "group flex flex-col rounded-3xl border border-border bg-surface p-4 text-left transition hover:border-ink/20 hover:shadow-soft";

  if (action.kind === "work_needs_story") {
    return (
      <button
        type="button"
        className={cls}
        disabled={createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        {createMut.isPending ? (
          <span className="text-sm text-ink-soft">Starting your draft…</span>
        ) : (
          body
        )}
      </button>
    );
  }

  return (
    <Link to={action.to as never} params={(action.params ?? {}) as never} className={cls}>
      {body}
    </Link>
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
      className="group flex w-[78vw] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft sm:w-[300px]"
    >
      {item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="aspect-[16/10] w-full gradient-motion opacity-60" />
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
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <Skeleton className="h-10 w-64" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function MemberHome() {
  const fetchHome = useServerFn(getMemberHome);
  const q = useQuery({
    queryKey: ["member-home"],
    queryFn: () => fetchHome(),
    staleTime: 60_000,
  });

  if (q.isLoading || !q.data) return <HomeSkeleton />;
  const data = q.data as MemberHomePayload;

  return (
    <div className="pb-24">
      <AtmosphereHeader data={data} />

      {/* Now — the three live slots, always rendered so the shape is stable. */}
      <HomeSection eyebrow="Right now" title="Now" divider={false} tone="quiet">
        <div className="grid gap-4 md:grid-cols-3">
          <TodaySlot today={data.today} />
          <LoungeSlot lounges={data.lounges} fallbackGroup={data.loungeFallbackGroup} />
          <EventSlot event={data.nextEvent} />
        </div>
      </HomeSection>

      {data.continueActions.length > 0 && (
        <HomeSection
          eyebrow="Pick it back up"
          title="Continue making"
          kicker="Small, finishable next steps from work you've already started."
          tone="quiet"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {data.continueActions.map((a) => (
              <ContinueCard key={`${a.kind}:${a.title}`} action={a} />
            ))}
          </div>
        </HomeSection>
      )}

      <WorkStoriesCarousel />

      {data.circle.length > 0 && (
        <HomeSection
          eyebrow="Your circles"
          title="Around you"
          kicker="People you follow, collaborators you've been credited with, and your Groups."
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
        >
          <div className="grid gap-4 md:grid-cols-3">
            {data.groupSuggestions.map((g) => (
              <Link
                key={g.id}
                to="/g/$slug"
                params={{ slug: g.slug }}
                className="group flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition hover:border-ink/20"
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
        <HomeSection eyebrow="Worth knowing" title="People in your orbit" tone="quiet">
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {data.people.map((p) => (
              <Link
                key={p.id}
                to="/u/$username"
                params={{ username: p.username }}
                className="group flex w-56 shrink-0 snap-start flex-col items-start gap-2 rounded-3xl border border-border bg-surface p-4 transition hover:border-ink/20"
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
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.disciplines.map((d) => (
              <Link
                key={d.id}
                to="/works/$slug"
                params={{ slug: d.slug }}
                className="group overflow-hidden rounded-3xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft"
              >
                {d.coverUrl ? (
                  <img
                    src={d.coverUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="aspect-[16/10] w-full gradient-motion opacity-60" />
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

      <HomeSection eyebrow="Make something" title="Start a new thing" divider tone="quiet">
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full gap-1.5">
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
