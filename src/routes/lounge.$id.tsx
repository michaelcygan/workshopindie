import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ArrowLeft, Rocket, X, Pencil, Check, DoorOpen } from "lucide-react";
import { mediumIcon } from "@/lib/medium-icons";
import { CreateCollabNudge } from "@/components/create-collab-nudge";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptWorkshopJoinInvite,
  declineWorkshopJoinInvite,
} from "@/lib/collab-workshop.functions";
import { renameLounge, endLounge, getInstantRoom } from "@/lib/instant.functions";


import { WaitingForOthersCard } from "@/components/waiting-for-others-card";
import { FocusStrip } from "@/components/focus-strip";
import { HopButton } from "@/components/hop-button";
import { CcConsentDialog } from "@/components/cc-consent-dialog";
import { toast } from "sonner";
import { formatRoomTitle } from "@/lib/instant";



const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });
const FALLBACK_TITLE = "Lounge";

export const Route = createFileRoute("/lounge/$id")({
  component: () => (
    <RequireAuth>
      <LiveRoomPage />
    </RequireAuth>
  ),
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Lounge" },
      { name: "description", content: "A live Lounge. Drop in, talk shop, find your people." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load this Lounge</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Try again
        </button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">This Lounge isn't here</h1>
      <p className="mt-2 text-ink-muted">It may have ended or the link is wrong.</p>
      <Link
        to="/lounge"
        className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-surface"
      >
        Back to Lounge
      </Link>
    </main>
  ),
});

type Room = {
  id: string;
  title: string;
  kind: string;
  medium: string | null;
  category: string | null;
  host_user_id: string | null;
  promoted_at: string | null;
  source_workshop_id: string | null;
  status: string;
  focus_message: string | null;
  locked: boolean;
  ended_by_user_id: string | null;
  workshop_id: string | null;
  claim_user_id: string | null;
  claim_started_at: string | null;
  claim_vetoed: boolean | null;
};

function LiveRoomPage() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const rename = useServerFn(renameLounge);
  const endRoom = useServerFn(endLounge);
  const fetchRoom = useServerFn(getInstantRoom);


  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room, isFetched } = useQuery({
    queryKey: ["instant-room", id],
    queryFn: async () => {
      const { room } = await fetchRoom({ data: { roomId: id } });
      return (room as Room | null) ?? null;
    },
    refetchInterval: 5000,
  });

  // Bad room ID → trigger the notFound boundary instead of a blank live-room shell.
  if (isFetched && room === null) throw notFound();

  // Pending opt-in invite for the persistent fork
  const { data: invite } = useQuery({
    queryKey: ["wji", room?.source_workshop_id, user?.id],
    enabled: !!user && !!room?.source_workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_join_invites")
        .select("workshop_id, status")
        .eq("workshop_id", room!.source_workshop_id!)
        .eq("invitee_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Persistent fork slug, when promoted
  const { data: forkedWs } = useQuery({
    queryKey: ["forked-ws", room?.source_workshop_id],
    enabled: !!room?.source_workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("id, slug, title")
        .eq("id", room!.source_workshop_id!)
        .maybeSingle();
      return data;
    },
  });

  const title = formatRoomTitle(room?.title, room?.medium) || FALLBACK_TITLE;
  // v1 "namer" model: host_user_id doubles as named_by_user_id.
  // Null = unnamed → anyone (or, for group rooms, any member) can name it.
  const namedByUserId = room?.host_user_id ?? null;
  const isNamed = !!namedByUserId;
  const isNamer = !!user && namedByUserId === user.id;
  const isHost = isNamer; // legacy rooms with host_user_id keep rename/end rights
  const isPromoted = !!room?.promoted_at;
  const isEnded = !!room && room.status !== "active";


  // If the room is ended/archived and you're not the host, bounce home.
  // Host stays so they can wrap up gracefully.
  useEffect(() => {
    if (!room || isPromoted || isHost) return;
    if (isEnded) {
      toast("This Lounge ended.");
      router.navigate({ to: "/lounge" });
    }
  }, [room, isEnded, isHost, isPromoted, router]);

  // Stash this room so /workshop can offer a quick "Rejoin" pill for 60s.
  // Skip when ended/locked — no point offering a rejoin into a dead room.
  useEffect(() => {
    if (typeof window === "undefined" || !id || isPromoted) return;
    return () => {
      if (isEnded || room?.locked) return;
      try {
        window.sessionStorage.setItem(
          "workshop:last-room",
          JSON.stringify({ id, title, leftAt: Date.now() }),
        );
      } catch {
        // ignore
      }
    };
  }, [id, title, isPromoted, isEnded, room?.locked]);

  // First-Workshop receipt — one-time gentle toast on the user's first join.
  useEffect(() => {
    if (typeof window === "undefined" || !user || !room?.id || isPromoted) return;
    try {
      if (window.localStorage.getItem("ws:first_done") === "1") return;
      window.localStorage.setItem("ws:first_done", "1");
      const t = setTimeout(() => toast.success("First Lounge — nicely done."), 1200);
      return () => clearTimeout(t);
    } catch {
      // ignore
    }
  }, [user, room?.id, isPromoted]);

  // Keyboard shortcut: "N" skips to next Lounge (guests only).
  useEffect(() => {
    if (!user || !room || isHost || isPromoted || room.status !== "active") return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement | null)?.isContentEditable
      )
        return;
      const btn = document.querySelector<HTMLButtonElement>("[data-hop-button]");
      btn?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, room, isHost, isPromoted]);

  // Live presence count for the "waiting for others" nudge.
  const { data: liveCount = 0 } = useQuery({
    queryKey: ["instant-room-live-count", id],
    enabled: !!user && !isPromoted,
    refetchInterval: 5000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", id)
        .gt("last_seen_at", cutoff);
      return count ?? 0;
    },
  });

  // Participants query retired — used to be for the HostMenu remove picker (v0).


  const acceptInvite = useServerFn(acceptWorkshopJoinInvite);
  const declineInvite = useServerFn(declineWorkshopJoinInvite);

  async function onAcceptInvite() {
    if (!room?.source_workshop_id) return;
    try {
      const { workshopSlug } = await acceptInvite({
        data: { workshopId: room.source_workshop_id },
      });
      if (workshopSlug) router.navigate({ to: "/workshops/$slug", params: { slug: workshopSlug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't accept");
    }
  }
  async function onDeclineInvite() {
    if (!room?.source_workshop_id) return;
    await declineInvite({ data: { workshopId: room.source_workshop_id } });
    qc.invalidateQueries({ queryKey: ["wji", room.source_workshop_id, user?.id] });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
      <CcConsentDialog />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <Link
            to="/lounge"
            className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink md:hidden"
          >
            <ArrowLeft className="h-3 w-3" /> Lounge
          </Link>
          {/* Editable Lounge name. Unnamed rooms show a "Name this Lounge" affordance
              to any signed-in viewer (members-only for group Lounges, enforced server-side).
              Named rooms are read-only for everyone except the namer. */}
          {(() => {
            const MediumIcon = mediumIcon(room?.medium ?? room?.category ?? null);
            const canRename = !!user && !isPromoted && (!isNamed || isNamer);

            async function saveTitle() {
              const next = draftTitle.trim();
              if (!next) { setEditingTitle(false); return; }
              if (next === title) { setEditingTitle(false); return; }
              setSavingTitle(true);
              try {
                await rename({ data: { roomId: id, title: next } });
                await qc.invalidateQueries({ queryKey: ["instant-room", id] });
                setEditingTitle(false);
                toast.success(isNamed ? "Renamed." : "You named this Lounge.");
              } catch (e: any) {
                toast.error(e?.message ?? "Couldn't rename");
              } finally {
                setSavingTitle(false);
              }
            }

            return (
              <h1 className="mt-0.5 flex min-w-0 items-center gap-2 font-display text-xl text-ink md:text-2xl">
                <span className="gradient-motion inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground">
                  <MediumIcon className="h-3.5 w-3.5" />
                </span>
                {editingTitle && canRename ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      ref={titleInputRef}
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value.slice(0, 80))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle();
                        if (e.key === "Escape") setEditingTitle(false);
                      }}
                      placeholder="Name this Lounge"
                      maxLength={80}
                      disabled={savingTitle}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-0.5 font-display text-xl md:text-2xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={saveTitle}
                      disabled={savingTitle}
                      className="grid h-7 w-7 place-items-center rounded-full text-primary hover:bg-primary/10"
                      aria-label="Save name"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTitle(false)}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted/40"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.5">
                    {(() => {
                      // Show the actual room title whenever we have one — matchmaker
                      // rooms already carry a sensible default ("Artist's Lounge",
                      // "Lounge: Film"). Only show the italic placeholder when we
                      // truly have nothing beyond the bare fallback.
                      const hasTitle = !!room?.title && title !== FALLBACK_TITLE;
                      return (
                        <span
                          className={
                            "truncate" +
                            (!hasTitle ? " text-ink-muted italic font-normal text-lg md:text-xl" : "")
                          }
                        >
                          {hasTitle ? title : "Name this Lounge"}
                        </span>
                      );
                    })()}
                    {canRename && (
                      <button
                        type="button"
                        onClick={() => {
                          const hasTitle = !!room?.title && title !== FALLBACK_TITLE;
                          setDraftTitle(hasTitle ? title : "");
                          setEditingTitle(true);
                          setTimeout(() => titleInputRef.current?.focus(), 0);
                        }}
                        className="grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-muted/40"
                        aria-label={isNamed ? "Rename Lounge" : "Name this Lounge"}
                        title={isNamed ? "Rename" : "Name this Lounge"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>

                )}
              </h1>
            );
          })()}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live · {liveCount}/5
            </span>
          </div>
        </div>

        {!isPromoted && user && (
          <div className="flex items-center gap-2">
            {room?.status === "active" && (
              <HopButton
                roomId={id}
                medium={(room?.medium as any) ?? null}
                mode={mode ?? "video"}
              />
            )}
            <button
              type="button"
              onClick={() => window.open(`/collab/new?fromLounge=${id}`, "_blank", "noopener,noreferrer")}
              className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink hover:bg-muted/40 transition"
              title="Post a Collab from this Lounge — it'll auto-pin here"
            >
              <Rocket className="h-3 w-3" /> New Collab
            </button>

            {isNamer && room?.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm("End this Lounge for everyone?")) return;
                  try {
                    await endRoom({ data: { roomId: id } });
                    toast("Lounge ended.");
                    router.navigate({ to: "/lounge" });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Couldn't end");
                  }
                }}
                className="rounded-full gap-1.5"
                title="End this Lounge"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">End</span>
              </Button>
            )}
          </div>
        )}
      </div>


      {/* Focus message — visible to everyone. In v1 there's no in-room host,
          so nobody sees the "set focus" affordance from here. */}
      {!isPromoted && (
        <FocusStrip
          text={room?.focus_message ?? null}
          isHost={false}
          onHostSet={() => {}}
        />
      )}

      <ChannelView
        key={id}
        roomId={id}
        title={title}
        hostUserId={room?.host_user_id ?? null}
        medium={(room?.medium as any) ?? (room?.category as any) ?? null}
        initialMode={mode ?? "video"}
      />


      <WaitingForOthersCard
        roomId={id}
        visible={!isPromoted && liveCount <= 1}
        canPingMutuals={false}
        filledSeats={Math.max(1, liveCount)}
        viewerInitials={(user?.email ?? "?").slice(0, 1).toUpperCase()}
      />

      {!isPromoted && (
        <CreateCollabNudge
          roomId={id}
          visible={!!user && liveCount >= 1}
          onCreate={() => window.open(`/collab/new?fromLounge=${id}`, "_blank", "noopener,noreferrer")}
        />
      )}
    </main>
  );
}

