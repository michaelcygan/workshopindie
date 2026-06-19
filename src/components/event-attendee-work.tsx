import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { listEventAttendeeCollabs, listEventAttendeeWorks } from "@/lib/group-events.functions";

type Attendee = { display_name: string | null; username: string | null; avatar_url: string | null };

function AttendeeChip({ a }: { a: Attendee | null }) {
  if (!a) return null;
  const name = a.display_name ?? a.username ?? "Attendee";
  const chip = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2 py-1 text-[11px] text-ink-soft">
      <Avatar className="h-4 w-4">
        <AvatarImage src={a.avatar_url ?? undefined} />
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-ink">{name}</span>
      <span className="text-ink-muted">· going</span>
    </span>
  );
  return a.username ? (
    <Link to="/u/$username" params={{ username: a.username }} className="relative z-20">
      {chip}
    </Link>
  ) : (
    chip
  );
}

export function EventAttendeeWork({ eventId }: { eventId: string }) {
  const [tab, setTab] = useState<"collabs" | "works">("collabs");
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 48 : 12;

  const collabsFn = useServerFn(listEventAttendeeCollabs);
  const worksFn = useServerFn(listEventAttendeeWorks);

  const collabs = useQuery({
    queryKey: ["event-attendee-collabs", eventId, limit],
    queryFn: () => collabsFn({ data: { event_id: eventId, limit } }),
    staleTime: 60_000,
  });
  const works = useQuery({
    queryKey: ["event-attendee-works", eventId, limit],
    queryFn: () => worksFn({ data: { event_id: eventId, limit } }),
    staleTime: 60_000,
  });

  const collabTotal = collabs.data?.total ?? 0;
  const workTotal = works.data?.total ?? 0;
  const isEmpty = !collabs.isLoading && !works.isLoading && collabTotal === 0 && workTotal === 0;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-ink">What people are working on</h3>
          <p className="text-xs text-ink-muted">Get to know the room before you arrive. Apply to collab, prep questions, follow up on the day.</p>
        </div>
        <div className="inline-flex rounded-full bg-ink/5 p-1 text-xs">
          <button
            onClick={() => setTab("collabs")}
            className={`rounded-full px-3 py-1.5 font-medium transition ${tab === "collabs" ? "bg-surface text-ink shadow-soft" : "text-ink-soft"}`}
          >
            Open collabs{collabTotal > 0 ? ` · ${collabTotal}` : ""}
          </button>
          <button
            onClick={() => setTab("works")}
            className={`rounded-full px-3 py-1.5 font-medium transition ${tab === "works" ? "bg-surface text-ink shadow-soft" : "text-ink-soft"}`}
          >
            Recent work{workTotal > 0 ? ` · ${workTotal}` : ""}
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-ink-muted" />
          <p className="text-sm text-ink-soft">No one's shared what they're working on yet.</p>
          <Link to="/collab/new" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            Be the first — post a collab →
          </Link>
        </div>
      ) : tab === "collabs" ? (
        <CollabTab data={collabs.data?.rows ?? []} loading={collabs.isLoading} />
      ) : (
        <WorkTab data={works.data?.rows ?? []} loading={works.isLoading} />
      )}

      {((tab === "collabs" && collabTotal > 12) || (tab === "works" && workTotal > 12)) && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="rounded-full">
            {expanded ? "Show less" : `See all ${tab === "collabs" ? collabTotal : workTotal}`}
          </Button>
        </div>
      )}
    </section>
  );
}

function CollabTab({ data, loading }: { data: unknown[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  type Row = CollabCardData & { user: Attendee | null };
  const rows = data as Row[];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.id} className="relative flex flex-col gap-2">
          <CollabCard post={r} />
          <div className="px-1"><AttendeeChip a={r.user ?? null} /></div>
        </div>
      ))}
    </div>
  );
}

function WorkTab({ data, loading }: { data: unknown[]; loading: boolean }) {
  if (loading) return <SkeletonGrid />;
  type Row = WorkCardData & { author: Attendee | null };
  const rows = data as Row[];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.id} className="relative flex flex-col gap-2">
          <WorkCard work={r} />
          <div className="px-1"><AttendeeChip a={r.author ?? null} /></div>
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
