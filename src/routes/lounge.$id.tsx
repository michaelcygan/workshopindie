import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ArrowLeft } from "lucide-react";
import { mediumIcon } from "@/lib/medium-icons";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { supabase } from "@/integrations/supabase/client";
import { getInstantRoom } from "@/lib/instant.functions";

import { WaitingForOthersCard } from "@/components/waiting-for-others-card";
import { FocusStrip } from "@/components/focus-strip";
import { HopButton } from "@/components/hop-button";
import { CcConsentDialog } from "@/components/cc-consent-dialog";
import { toast } from "sonner";
import { formatRoomTitle } from "@/lib/instant";
import { LoungeAudioProvider } from "@/components/stream-lounge-provider";
import { normalizeLoungeMode } from "@/lib/lounge-constants";

// Accepts the new chat|audio vocabulary and coerces legacy voice|video values
// (voice → audio, video → audio). Cameras no longer exist in audio rooms; legacy
// video links never reactivate camera behavior — they simply enter as audio.
const searchSchema = z.object({
  mode: z
    .enum(["chat", "audio", "voice", "video"])
    .optional()
    .transform((v) => (v === "video" || v === "voice" ? "audio" : v)),
});
const FALLBACK_TITLE = "Audio room";

export const Route = createFileRoute("/lounge/$id")({
  component: () => (
    <RequireAuth>
      <LiveRoomPage />
    </RequireAuth>
  ),
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Audio room" },
      { name: "description", content: "A live audio room. Drop in, talk shop, find your people." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: LoungeErrorBoundary,
  notFoundComponent: LoungeNotFound,
});

function LoungeNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">This room isn't here</h1>
      <p className="mt-2 text-ink-muted">It may have ended or the link is wrong.</p>
      <Link
        to="/groups"
        className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-surface"
      >
        Browse Groups
      </Link>
    </main>
  );
}

function LoungeLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-sm text-ink-muted">Loading room…</p>
    </main>
  );
}

function LoungeErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  // Log for diagnostics; keep user-facing copy friendly.
  if (typeof console !== "undefined") console.error("[audio-room] boundary:", error);
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">This room hit a snag</h1>
      <p className="mt-2 text-sm text-ink-muted">
        A temporary problem interrupted this room. Try reconnecting, or head back to Groups.
      </p>
      {error?.message && (
        <p className="mt-3 mx-auto max-w-md break-words text-[11px] text-ink-muted/70">
          {error.message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={async () => {
            // Clear any stuck room caches, cancel in-flight, then re-run loaders.
            await qc.cancelQueries({ queryKey: ["instant-room"] });
            qc.removeQueries({ queryKey: ["instant-room"] });
            qc.removeQueries({ queryKey: ["instant-room-live-count"] });
            router.invalidate();
            reset();
          }}
          className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Try again
        </button>
        <Link
          to="/groups"
          onClick={() => reset()}
          className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Back to Groups
        </Link>
      </div>
    </main>
  );
}

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
  screening_work_id: string | null;
};

function LiveRoomPage() {
  const { id } = Route.useParams();
  // `mode` from search is normalized upstream to "chat" | "audio" (legacy
  // voice/video are coerced to "audio"). We forward it to ChannelView so it
  // only auto-requests the mic when the URL explicitly asks for audio.
  const { mode: entryMode } = Route.useSearch();
  const { user, loading } = useAuth();
  const router = useRouter();
  const fetchRoom = useServerFn(getInstantRoom);

  // Legacy standalone room: Groups own naming, ending and Collab pinning now,
  // so this page is chat + audio only.


  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room, isFetched } = useQuery({
    queryKey: ["instant-room", id],
    queryFn: async () => {
      try {
        const { room } = await fetchRoom({ data: { roomId: id } });
        return (room as Room | null) ?? null;
      } catch (e: any) {
        // On flaky mobile/in-app browsers the Supabase bearer sometimes isn't
        // attached on the first call. Treat auth errors as "no room yet" so
        // we render the friendly NotFound instead of the scary error boundary;
        // the 5s refetch will recover once auth hydrates.
        const msg = String(e?.message ?? "");
        if (/unauthor/i.test(msg) || /401/.test(msg)) return null;
        throw e;
      }
    },
    refetchInterval: 5000,
    retry: 1,
  });

  // Compatibility redirect: group-backed rooms now live inside their Group,
  // which owns the audio layer. Rooms with no group (legacy / instant /
  // collab-spawned) keep rendering here exactly as before.
  const roomGroupId = (room as { group_id?: string | null } | null)?.group_id ?? null;
  useEffect(() => {
    if (!roomGroupId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("groups")
        .select("slug")
        .eq("id", roomGroupId)
        .maybeSingle();
      const slug = (data as { slug?: string } | null)?.slug;
      if (!cancelled && slug) {
        router.navigate({ to: "/g/$slug", params: { slug }, replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomGroupId, router]);

  // Bad room ID → render inline NotFound AFTER all hooks (never mid-render — that
  // would change the hook count between renders and trip the React hooks-order guard).
  const roomMissing = isFetched && room === null;

  // Legacy Workshop fork invites retired — audio invitations are bound to the
  // room itself (see `lounge_invitations` + inviteFriendToLounge).

  const title = formatRoomTitle(room?.title, room?.medium) || FALLBACK_TITLE;
  const isPromoted = !!room?.promoted_at;
  const isEnded = !!room && room.status === "ended";
  const isArchived = !!room && room.status === "archived";

  // Ended or archived rooms bounce everyone back to Groups, which own the live layer.
  useEffect(() => {
    if (!room || isPromoted) return;
    if (isArchived || isEnded) {
      toast(isEnded ? "This audio room ended." : "That audio room is no longer live.");
      router.navigate({ to: "/groups" });
    }
  }, [room, isEnded, isArchived, isPromoted, router]);


  // Stash this room so /workshop can offer a quick "Rejoin" pill for 60s.
  // Skip when ended/locked — no point offering a rejoin into a dead room.
  useEffect(() => {
    if (typeof window === "undefined" || !id || isPromoted) return;
    return () => {
      if (isEnded || isArchived || room?.locked) return;
      try {
        window.sessionStorage.setItem(
          "workshop:last-room",
          JSON.stringify({ id, title, leftAt: Date.now() }),
        );
      } catch {
        // ignore
      }
    };
  }, [id, title, isPromoted, isEnded, isArchived, room?.locked]);

  // First-Workshop receipt — one-time gentle toast on the user's first join.
  useEffect(() => {
    if (typeof window === "undefined" || !user || !room?.id || isPromoted) return;
    try {
      if (window.localStorage.getItem("ws:first_done") === "1") return;
      window.localStorage.setItem("ws:first_done", "1");
      const t = setTimeout(() => toast.success("First audio room — nicely done."), 1200);
      return () => clearTimeout(t);
    } catch {
      // ignore
    }
  }, [user, room?.id, isPromoted]);

  // Live presence count for the "waiting for others" nudge.
  const { data: liveCount = 0 } = useQuery({
    queryKey: ["instant-room-live-count", id],
    enabled: !!user && !isPromoted,
    refetchInterval: 5000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
      const { count } = await supabase
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", id)
        .gt("last_seen_at", cutoff);
      return count ?? 0;
    },
  });

  // Participants query retired — used to be for the HostMenu remove picker (v0).

  // All hooks above run unconditionally on every render. Only branch on rendering below.
  if (roomMissing) return <LoungeNotFound />;

  return (
    <LoungeAudioProvider roomId={id} participation={normalizeLoungeMode(entryMode)}>
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
        <CcConsentDialog />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <Link
              to="/groups"
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink md:hidden"
            >
              <ArrowLeft className="h-3 w-3" /> Groups
            </Link>
            {(() => {
              const MediumIcon = mediumIcon(room?.medium ?? room?.category ?? null);
              const hasTitle = !!room?.title && title !== FALLBACK_TITLE;
              return (
                <h1 className="mt-0.5 flex min-w-0 items-center gap-2 font-display text-xl text-ink md:text-2xl">
                  <span className="gradient-motion inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground">
                    <MediumIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{hasTitle ? title : FALLBACK_TITLE}</span>
                </h1>
              );
            })()}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live · {liveCount}/10
              </span>
            </div>
          </div>
        </div>

        {/* Focus message — visible to everyone. Groups own hosting now, so
          nobody sees the "set focus" affordance from this legacy room. */}
        {!isPromoted && (
          <FocusStrip text={room?.focus_message ?? null} isHost={false} onHostSet={() => {}} />
        )}

        <ChannelView
          key={id}
          roomId={id}
          title={title}
          hostUserId={room?.host_user_id ?? null}
          medium={(room?.medium as any) ?? (room?.category as any) ?? null}
          // Wave 2: forward the entry preference. `entryMode` is "chat" | "audio"
          // (legacy voice/video already coerced to "audio" by the search schema).
          // Undefined → chat-only entry (Drop in button default).
          initialMode={entryMode ?? "chat"}
          screeningWorkId={room?.screening_work_id ?? null}
          nextLoungeSlot={
            !isPromoted && room?.status === "active" ? (
              <HopButton
                roomId={id}
                medium={(room?.medium as any) ?? null}
                // Preserve current participation intent when hopping.
                mode={entryMode ?? "chat"}
                tone="primary"
              />
            ) : null
          }
        />

        <WaitingForOthersCard
          roomId={id}
          visible={!isPromoted && liveCount <= 1}
          canPingMutuals={false}
          filledSeats={Math.max(1, liveCount)}
          viewerInitials={(user?.email ?? "?").slice(0, 1).toUpperCase()}
        />
      </main>
    </LoungeAudioProvider>
  );
}

