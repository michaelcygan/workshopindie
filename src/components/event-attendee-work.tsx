import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Users } from "lucide-react";
import type { CollabCardData } from "@/components/collab-card";
import type { WorkCardData } from "@/components/work-card";
import { CollabPeek } from "@/components/collab-peek";
import { WorkPeek } from "@/components/work-peek";
import { ProfilePeek } from "@/components/profile-peek";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/categories";
import { listEventAttendeeCollabs, listEventAttendeeWorks } from "@/lib/group-events.functions";

type Attendee = { display_name: string | null; username: string | null; avatar_url: string | null; id?: string };
type Group<T> = { uid: string; user: Attendee | null; items: T[]; remaining: number };
type Payload<T> = { fair: T[]; byPerson: Group<T>[]; totalAttendees: number; totalItems: number };

type CollabRow = CollabCardData & { cover_url?: string | null; user?: Attendee | null };
type WorkRow = WorkCardData & { author?: Attendee | null; created_by?: string };

export function EventAttendeeWork({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<"collabs" | "works">("collabs");
  const [expanded, setExpanded] = useState(false);
  const [peekCollabId, setPeekCollabId] = useState<string | null>(null);
  const [peekWorkId, setPeekWorkId] = useState<string | null>(null);

  const collabsFn = useServerFn(listEventAttendeeCollabs);
  const worksFn = useServerFn(listEventAttendeeWorks);

  const collabs = useQuery({
    queryKey: ["event-attendee-collabs", eventId, expanded],
    queryFn: () =>
      collabsFn({ data: { event_id: eventId, mode: expanded ? "byPerson" : "fair", perUserCap: expanded ? 4 : 3 } }) as Promise<Payload<CollabRow>>,
    staleTime: 60_000,
  });
  const works = useQuery({
    queryKey: ["event-attendee-works", eventId, expanded],
    queryFn: () =>
      worksFn({ data: { event_id: eventId, mode: expanded ? "byPerson" : "fair", perUserCap: expanded ? 8 : 6 } }) as Promise<Payload<WorkRow>>,
    staleTime: 60_000,
  });

  const cAttendees = collabs.data?.totalAttendees ?? 0;
  const wAttendees = works.data?.totalAttendees ?? 0;
  const cTotal = collabs.data?.totalItems ?? 0;
  const wTotal = works.data?.totalItems ?? 0;
  const isEmpty = !collabs.isLoading && !works.isLoading && cAttendees === 0 && wAttendees === 0;
  const activeAttendees = tab === "collabs" ? cAttendees : wAttendees;

  const openCollab = (id: string) => setPeekCollabId(id);
  const openWork = (id: string) => setPeekWorkId(id);

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-ink">What people are working on</h3>
          <p className="text-xs text-ink-muted">
            {expanded
              ? `Everyone at this event with shareable work — ${activeAttendees} attendees.`
              : `Tap a tile to peek — ${activeAttendees > 0 ? `${activeAttendees} attendees sharing work` : "scan the room before you arrive"}.`}
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
          <ByPersonCollabs groups={collabs.data?.byPerson ?? []} loading={collabs.isLoading} onOpen={openCollab} />
        ) : (
          <FairCollabs items={collabs.data?.fair ?? []} loading={collabs.isLoading} onOpen={openCollab} />
        )
      ) : expanded ? (
        <ByPersonWorks groups={works.data?.byPerson ?? []} loading={works.isLoading} onOpen={openWork} />
      ) : (
        <FairWorks items={works.data?.fair ?? []} loading={works.isLoading} onOpen={openWork} />
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

      <CollabPeek
        collabId={peekCollabId}
        open={!!peekCollabId}
        onOpenChange={(v) => !v && setPeekCollabId(null)}
      />
      <WorkPeek
        workId={peekWorkId}
        open={!!peekWorkId}
        onOpenChange={(v) => !v && setPeekWorkId(null)}
      />
    </section>
  );
}

function AuthorFooter({ user }: { user: Attendee | null }) {
  if (!user) return null;
  const name = user.display_name ?? user.username ?? "Attendee";
  const inner = (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarImage src={user.avatar_url ?? undefined} />
        <AvatarFallback className="text-[9px]">{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-[11px] text-ink-soft">{name}</span>
    </span>
  );
  if (user.id) {
    return (
      <ProfilePeek userId={user.id}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-1 py-0.5 text-left hover:bg-ink/5"
        >
          {inner}
        </button>
      </ProfilePeek>
    );
  }
  return <div className="mt-2 flex min-w-0 items-center gap-1.5 px-1">{inner}</div>;
}

function CompactCollabTile({ post, onOpen }: { post: CollabRow; onOpen: (id: string) => void }) {
  const catLabel = CATEGORY_LABELS[post.category] ?? post.category;
  const openRoles = (post.roles ?? []).length;
  return (
    <div className="group flex min-w-0 flex-col">
      <button
        type="button"
        onClick={() => onOpen(post.id)}
        className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
          {post.cover_url ? (
            <img src={post.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-muted">
              <Users className="h-6 w-6" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-medium text-ink shadow-soft backdrop-blur">
            {catLabel}
          </span>
          {post.status === "open" && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Open
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{post.title}</p>
          {openRoles > 0 && (
            <p className="text-[11px] text-ink-muted">{openRoles} role{openRoles === 1 ? "" : "s"} open</p>
          )}
        </div>
      </button>
      <AuthorFooter user={post.user ?? null} />
    </div>
  );
}

function CompactWorkTile({ work, onOpen }: { work: WorkRow; onOpen: (id: string) => void }) {
  const catLabel = CATEGORY_LABELS[work.category] ?? work.category;
  return (
    <div className="group flex min-w-0 flex-col">
      <button
        type="button"
        onClick={() => onOpen(work.id)}
        className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-ink/5">
          {work.cover_url ? (
            <img src={work.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-muted">
              <Sparkles className="h-6 w-6" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-medium text-ink shadow-soft backdrop-blur">
            {catLabel}
          </span>
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{work.title}</p>
        </div>
      </button>
      <AuthorFooter user={work.author ?? null} />
    </div>
  );
}

function FairCollabs({ items, loading, onOpen }: { items: CollabRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((r) => <CompactCollabTile key={r.id} post={r} onOpen={onOpen} />)}
    </div>
  );
}

function FairWorks({ items, loading, onOpen }: { items: WorkRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((r) => <CompactWorkTile key={r.id} work={r} onOpen={onOpen} />)}
    </div>
  );
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

function ByPersonCollabs({ groups, loading, onOpen }: { groups: Group<CollabRow>[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.uid} className="rounded-2xl border border-border bg-surface-2/30 p-4">
          <PersonHeader user={g.user} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((r) => <CompactCollabTile key={r.id} post={{ ...r, user: g.user }} onOpen={onOpen} />)}
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

function ByPersonWorks({ groups, loading, onOpen }: { groups: Group<WorkRow>[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <SkeletonGrid />;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.uid} className="rounded-2xl border border-border bg-surface-2/30 p-4">
          <PersonHeader user={g.user} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((r) => <CompactWorkTile key={r.id} work={{ ...r, author: g.user }} onOpen={onOpen} />)}
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink/5" />
      ))}
    </div>
  );
}
