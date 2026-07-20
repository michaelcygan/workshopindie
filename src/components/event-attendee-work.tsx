import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { listEventAttendeeCollabs, listEventAttendeeWorks } from "@/lib/group-events.functions";

type Attendee = { display_name: string | null; username: string | null; avatar_url: string | null };
type Group<T> = { uid: string; user: Attendee | null; items: T[]; remaining: number };
type Payload<T> = { fair: T[]; byPerson: Group<T>[]; totalAttendees: number; totalItems: number };

export function EventAttendeeWork({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<"collabs" | "works">("collabs");
  const [expanded, setExpanded] = useState(false);

  const collabsFn = useServerFn(listEventAttendeeCollabs);
  const worksFn = useServerFn(listEventAttendeeWorks);

  const collabs = useQuery({
    queryKey: ["event-attendee-collabs", eventId, expanded],
    queryFn: () =>
      collabsFn({ data: { event_id: eventId, mode: expanded ? "byPerson" : "fair", perUserCap: expanded ? 3 : 2 } }) as Promise<Payload<CollabCardData>>,
    staleTime: 60_000,
  });
  const works = useQuery({
    queryKey: ["event-attendee-works", eventId, expanded],
    queryFn: () =>
      worksFn({ data: { event_id: eventId, mode: expanded ? "byPerson" : "fair", perUserCap: expanded ? 6 : 3 } }) as Promise<Payload<WorkCardData & { created_by?: string }>>,
    staleTime: 60_000,
  });

  const cAttendees = collabs.data?.totalAttendees ?? 0;
  const wAttendees = works.data?.totalAttendees ?? 0;
  const cTotal = collabs.data?.totalItems ?? 0;
  const wTotal = works.data?.totalItems ?? 0;
  const isEmpty = !collabs.isLoading && !works.isLoading && cAttendees === 0 && wAttendees === 0;

  const activeAttendees = tab === "collabs" ? cAttendees : wAttendees;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-ink">What people are working on</h3>
          <p className="text-xs text-ink-muted">
            {expanded
              ? `Everyone at this event with shareable work — ${activeAttendees} attendees.`
              : `Get to know the room before you arrive — ${activeAttendees > 0 ? `${activeAttendees} attendees sharing work` : "scan the room before you arrive"}.`}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-ink/5 p-1 text-xs">
          <button
            onClick={() => setTab("collabs")}
            className={`rounded-full px-3 py-1.5 font-medium transition ${tab === "collabs" ? "bg-surface text-ink shadow-soft" : "text-ink-soft"}`}
          >
            Open collabs{cAttendees > 0 ? ` · ${cAttendees}` : ""}
          </button>
          <button
            onClick={() => setTab("works")}
            className={`rounded-full px-3 py-1.5 font-medium transition ${tab === "works" ? "bg-surface text-ink shadow-soft" : "text-ink-soft"}`}
          >
            Recent work{wAttendees > 0 ? ` · ${wAttendees}` : ""}
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-ink-muted" />
          <p className="text-sm text-ink-soft">No one's shared work yet.</p>
          <Link to="/collab/new" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            Be the first — post a collab →
          </Link>
        </div>
      ) : tab === "collabs" ? (
        expanded ? (
          <ByPersonCollabs groups={collabs.data?.byPerson ?? []} loading={collabs.isLoading} />
        ) : (
          <FairCollabs items={collabs.data?.fair ?? []} loading={collabs.isLoading} />
        )
      ) : expanded ? (
        <ByPersonWorks groups={works.data?.byPerson ?? []} loading={works.isLoading} />
      ) : (
        <FairWorks items={works.data?.fair ?? []} loading={works.isLoading} />
      )}

      {!isEmpty && activeAttendees > 0 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="rounded-full">
            {expanded
              ? "Show less"
              : tab === "collabs"
                ? `See everyone (${cAttendees} ${cAttendees === 1 ? "attendee" : "attendees"}, ${cTotal} collabs)`
                : `See everyone (${wAttendees} ${wAttendees === 1 ? "attendee" : "attendees"}, ${wTotal} works)`}
          </Button>
        </div>
      )}
    </section>
  );
}

function AttendeeChip({ a }: { a: (Attendee & { rsvp?: string }) | null }) {
  if (!a) return null;
  const name = a.display_name ?? a.username ?? "Attendee";
  const inner = (
    <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/5 px-2 py-1 text-[11px] text-ink-soft">
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarImage src={a.avatar_url ?? undefined} />
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-ink">{name}</span>
      <span className="shrink-0 text-ink-muted">· going</span>
    </span>
  );
  return a.username ? (
    <Link to="/u/$username" params={{ username: a.username }} className="relative z-20 inline-flex min-w-0 max-w-full">{inner}</Link>
  ) : inner;
}

function PersonHeader({ user }: { user: Attendee | null }) {
  if (!user) return null;
  const name = user.display_name ?? user.username ?? "Attendee";
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={user.avatar_url ?? undefined} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-ink">{name}</span>
          <span className="text-[11px] text-ink-muted">going</span>
        </div>
      </div>
      {user.username && (
        <Link to="/u/$username" params={{ username: user.username }} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          View profile <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function FairCollabs({ items, loading }: { items: CollabCardData[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  type Row = CollabCardData & { user: Attendee | null };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(items as Row[]).map((r) => (
        <div key={r.id} className="relative flex min-w-0 flex-col gap-2">
          <CollabCard post={r} />
          <div className="min-w-0 px-1"><AttendeeChip a={r.user ?? null} /></div>
        </div>
      ))}
    </div>
  );
}

function FairWorks({ items, loading }: { items: (WorkCardData & { author?: Attendee | null })[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((r) => (
        <div key={r.id} className="relative flex min-w-0 flex-col gap-2">
          <WorkCard work={r} showAvatars />
          <div className="min-w-0 px-1"><AttendeeChip a={r.author ?? null} /></div>
        </div>
      ))}
    </div>
  );
}

function ByPersonCollabs({ groups, loading }: { groups: Group<CollabCardData>[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.uid} className="rounded-2xl border border-border bg-surface-2/30 p-4">
          <PersonHeader user={g.user} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((r) => <CollabCard key={r.id} post={r} />)}
          </div>
          {g.remaining > 0 && g.user?.username && (
            <Link to="/u/$username" params={{ username: g.user.username }} className="mt-3 inline-block text-xs text-primary hover:underline">
              +{g.remaining} more on profile →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function ByPersonWorks({ groups, loading }: { groups: Group<WorkCardData>[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.uid} className="rounded-2xl border border-border bg-surface-2/30 p-4">
          <PersonHeader user={g.user} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((r) => <WorkCard key={r.id} work={r} showAvatars />)}
          </div>
          {g.remaining > 0 && g.user?.username && (
            <Link to="/u/$username" params={{ username: g.user.username }} className="mt-3 inline-block text-xs text-primary hover:underline">
              +{g.remaining} more on profile →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-ink/5" />
      ))}
    </div>
  );
}
