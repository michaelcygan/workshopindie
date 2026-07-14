import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  listEventShowcase, listMyShowcaseCandidates, addShowcaseItem, removeShowcaseItem,
  type ShowcaseEntry, type Bringer,
} from "@/lib/event-showcase.functions";
import { toast } from "sonner";

type Props = {
  eventId: string;
  eventTitle: string;
  /** When true, the viewer is RSVP'd going/maybe and can bring items. */
  canBring: boolean;
};

export function EventShowcaseStrip({ eventId, eventTitle, canBring }: Props) {
  const listFn = useServerFn(listEventShowcase);
  const { data: entries } = useQuery({
    queryKey: ["event-showcase", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    staleTime: 30_000,
  });

  const items = entries ?? [];
  if (items.length === 0 && !canBring) return null;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-ink">Bringing tonight</h3>
          <p className="text-xs text-ink-muted">
            Works and open collabs people are bringing to {eventTitle}.
          </p>
        </div>
        {canBring && <BringDialog eventId={eventId} />}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing yet. Be the first — tap "Bring something".
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((entry) => (
            <li key={`${entry.kind}:${entry.item_id}`}>
              <ShowcaseRow entry={entry} eventId={eventId} canBring={canBring} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShowcaseRow({
  entry, eventId, canBring,
}: { entry: ShowcaseEntry; eventId: string; canBring: boolean }) {
  const cardInner = (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-border bg-surface-2/40 p-3 transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
        {entry.cover_url ? (
          <img src={entry.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-muted">
            <Sparkles className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            {entry.kind === "work" ? "Work" : "Open collab"}
          </span>
        </div>
        <div className="mt-0.5 truncate font-display text-sm text-ink">{entry.title}</div>
        <BringersChip bringers={entry.bringers} />
      </div>
    </div>
  );

  const link =
    entry.kind === "work" && entry.slug ? (
      <Link to="/works/$slug" params={{ slug: entry.slug }} className="block h-full">{cardInner}</Link>
    ) : entry.kind === "collab" && entry.slug ? (
      <Link to="/collab/$slug" params={{ slug: entry.slug }} className="block h-full">{cardInner}</Link>
    ) : (
      <div className="h-full">{cardInner}</div>
    );

  return (
    <div className="group relative">
      {link}
      {canBring && <RemoveSelfButton eventId={eventId} entry={entry} />}
    </div>
  );
}

function BringersChip({ bringers }: { bringers: Bringer[] }) {
  const visible = bringers.slice(0, 3);
  const extra = bringers.length - visible.length;
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {visible.map((b) => (
          <Avatar key={b.user_id} className="h-5 w-5 ring-2 ring-surface">
            <AvatarImage src={b.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px]">{(b.display_name ?? "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="text-[11px] text-ink-muted">
        {bringers.length === 1
          ? `${bringers[0].display_name ?? bringers[0].username ?? "Someone"} is bringing`
          : `${bringers.length}${extra > 0 ? "" : ""} are bringing`}
      </span>
    </div>
  );
}

function RemoveSelfButton({ eventId, entry }: { eventId: string; entry: ShowcaseEntry }) {
  const qc = useQueryClient();
  const removeFn = useServerFn(removeShowcaseItem);
  const [loading, setLoading] = useState(false);
  // Only show remove if viewer is in bringers (we don't know viewer id here cheaply; rely on server to no-op).
  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await removeFn({
        data: {
          event_id: eventId,
          work_id: entry.kind === "work" ? entry.item_id : undefined,
          collab_id: entry.kind === "collab" ? entry.item_id : undefined,
        },
      });
      qc.invalidateQueries({ queryKey: ["event-showcase", eventId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={remove}
      className="absolute right-2 top-2 hidden rounded-full bg-background/90 p-1 text-ink-muted opacity-0 shadow-soft transition group-hover:flex group-hover:opacity-100 hover:text-ink"
      aria-label="Stop bringing this"
      title="Stop bringing this"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </button>
  );
}

function BringDialog({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listMineFn = useServerFn(listMyShowcaseCandidates);
  const addFn = useServerFn(addShowcaseItem);
  const removeFn = useServerFn(removeShowcaseItem);

  const { data, isLoading } = useQuery({
    queryKey: ["showcase-candidates", eventId],
    queryFn: () => listMineFn({ data: { event_id: eventId } }),
    enabled: open,
  });

  async function toggleWork(workId: string, brought: boolean) {
    try {
      if (brought) {
        await removeFn({ data: { event_id: eventId, work_id: workId } });
      } else {
        await addFn({ data: { event_id: eventId, work_id: workId } });
      }
      qc.invalidateQueries({ queryKey: ["event-showcase", eventId] });
      qc.invalidateQueries({ queryKey: ["showcase-candidates", eventId] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function toggleCollab(collabId: string, brought: boolean) {
    try {
      if (brought) {
        await removeFn({ data: { event_id: eventId, collab_id: collabId } });
      } else {
        await addFn({ data: { event_id: eventId, collab_id: collabId } });
      }
      qc.invalidateQueries({ queryKey: ["event-showcase", eventId] });
      qc.invalidateQueries({ queryKey: ["showcase-candidates", eventId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const works = data?.works ?? [];
  const collabs = data?.collabs ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Bring something
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Bring to the event</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a public work or open collab. Other attendees see it on the event page.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-ink/5" />
            <div className="h-12 animate-pulse rounded-xl bg-ink/5" />
          </div>
        ) : works.length === 0 && collabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/30 p-5 text-center text-sm text-ink-soft">
            You don't have a published public work or open collab yet.
            <div className="mt-3 flex justify-center gap-2">
              <Link to="/works/new" className="text-xs font-medium text-primary hover:underline">Post to Gallery →</Link>
              <Link to="/collab/new" className="text-xs font-medium text-primary hover:underline">Start a collab →</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {collabs.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Open collabs</div>
                <ul className="space-y-1.5">
                  {collabs.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => toggleCollab(c.id, c.brought)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          c.brought ? "border-primary/50 bg-primary/5" : "border-border bg-surface-2/40 hover:border-primary/30"
                        }`}
                      >
                        <span className="truncate text-ink">{c.title}</span>
                        <span className="ml-2 shrink-0 text-[11px] font-medium text-primary">
                          {c.brought ? "Bringing ✓" : "Bring"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {works.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Works</div>
                <ul className="space-y-1.5">
                  {works.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => toggleWork(w.id, w.brought)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left text-sm transition ${
                          w.brought ? "border-primary/50 bg-primary/5" : "border-border bg-surface-2/40 hover:border-primary/30"
                        }`}
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {w.cover_url && <img src={w.cover_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <span className="flex-1 truncate text-ink">{w.title}</span>
                        <span className="ml-2 shrink-0 text-[11px] font-medium text-primary">
                          {w.brought ? "Bringing ✓" : "Bring"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
