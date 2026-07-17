import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Radio, Share2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  listActiveInstantRooms,
  joinSpecificInstantRoom,
  type ActiveInstantRoom,
} from "@/lib/instant.functions";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatRoomTitle } from "@/lib/instant";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  canJoin: boolean;
  medium?: Category | null;
  onTakeSeat: (roomId: string) => Promise<void> | void;
  /** "cards" = desktop default; "compact-pills" = mobile horizontal pill row. */
  variant?: "cards" | "compact-pills";
};


function labelFor(medium: Category | null) {
  if (!medium) return "Open topic";
  return CATEGORIES.find((c) => c.id === medium)?.label ?? medium;
}

export function LiveWorkshopsRail({ canJoin, medium = null, onTakeSeat, variant = "cards" }: Props) {
  const fetchRooms = useServerFn(listActiveInstantRooms);
  const joinRoom = useServerFn(joinSpecificInstantRoom);
  const qc = useQueryClient();
  const [busyRoom, setBusyRoom] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["instant-active-rooms"],
    queryFn: () => fetchRooms(),
    refetchInterval: 5000,
  });

  const allRooms = data?.rooms ?? [];
  const scoped = medium ? allRooms.filter((r) => r.medium === medium) : allRooms;
  const rooms = scoped.filter((r) => r.live_count < 5);
  const fullRooms = scoped.filter((r) => r.live_count >= 5);
  const mediumLabel = medium ? CATEGORIES.find((c) => c.id === medium)?.label ?? medium : null;

  async function takeSeat(r: ActiveInstantRoom) {
    if (busyRoom || !canJoin) return;
    setBusyRoom(r.id);
    try {
      const { roomId } = await joinRoom({ data: { roomId: r.id } });
      await onTakeSeat(roomId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't take that seat");
      qc.invalidateQueries({ queryKey: ["instant-active-rooms"] });
      setBusyRoom(null);
    }
  }

  function copyLink(r: ActiveInstantRoom) {
    const path = `/lounge/${r.id}`;
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied — share to fill the room"),
      () => toast.error("Couldn't copy link"),
    );
  }

  if (!data) {
    return (
      <section className="mt-10">
        <RailHeader subtitle="Loading live rooms…" />
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      </section>
    );
  }

  if (rooms.length === 0 && fullRooms.length === 0) {
    return (
      <section className="mt-10">
        <RailHeader subtitle={mediumLabel ? `No ${mediumLabel} rooms live` : "No one's live right now."} />
        <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-sm text-ink-soft">
            {mediumLabel
              ? `Be the first ${mediumLabel} room — open one and others will see you live within seconds.`
              : "Be the first — drop in and others will see you live within seconds."}
          </p>
        </div>
      </section>
    );
  }

  const total = rooms.length + fullRooms.length;
  return (
    <section className="mt-10">
      <RailHeader subtitle={`${total} ${mediumLabel ? `${mediumLabel} ` : ""}room${total === 1 ? "" : "s"} live now`} />
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <article
            key={r.id}
            className="group flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {labelFor(r.medium as Category | null)}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-ink-muted">{r.live_count}/5</span>
            </div>
            <h3 className="mt-2 truncate font-display text-lg text-ink">{formatRoomTitle(r.title, r.medium)}</h3>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {r.participants.slice(0, 3).map((p) => {
                  const name = p.display_name || p.username || "Anon";
                  return (
                    <Avatar key={p.user_id} className="h-7 w-7 ring-2 ring-surface">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
                    </Avatar>
                  );
                })}
                {r.participants.length === 0 && (
                  <div className="h-7 w-7 rounded-full bg-muted ring-2 ring-surface" />
                )}
              </div>
              {r.live_count > 3 && (
                <span className="text-[11px] text-ink-muted">+{r.live_count - 3} more</span>
              )}
              <button
                type="button"
                onClick={() => copyLink(r)}
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink transition"
                aria-label="Copy room link"
                title="Copy share link"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              onClick={() => takeSeat(r)}
              disabled={!canJoin || busyRoom !== null}
              size="sm"
              className="mt-4 w-full rounded-full gap-1.5"
            >
              {busyRoom === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              {busyRoom === r.id ? "Taking your seat…" : "Take an open seat"}
            </Button>
          </article>
        ))}

        {fullRooms.map((r) => (
          <article
            key={r.id}
            className="flex flex-col rounded-2xl border border-border bg-surface-2 p-4 opacity-75"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                {labelFor(r.medium as Category | null)}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-ink-muted">5/5 · full</span>
            </div>
            <h3 className="mt-2 truncate font-display text-lg text-ink">{formatRoomTitle(r.title, r.medium)}</h3>
            <p className="mt-3 text-xs text-ink-muted">Full — try another room or open your own.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RailHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl text-ink">Live now</h2>
      <span className="text-xs text-ink-muted">{subtitle}</span>
    </div>
  );
}
