import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Coffee, Crown, Rocket, Sparkles, ArrowRight, X } from "lucide-react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createCollabFromRoom, acceptWorkshopJoinInvite, declineWorkshopJoinInvite } from "@/lib/collab-workshop.functions";
import { WorkshopToolsPanel } from "@/components/workshop-tools-panel";
import { HostFirstRunTour } from "@/components/host-first-run-tour";
import { WaitingForOthersCard } from "@/components/waiting-for-others-card";
import { FocusStrip } from "@/components/focus-strip";
import { HostedByLine } from "@/components/hosted-by-line";
import { HostMenu } from "@/components/host-menu";
import { HopButton } from "@/components/hop-button";
import { HostRoomEvents } from "@/components/host-room-events";
import { toast } from "sonner";
import { formatRoomTitle } from "@/lib/instant";

const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });
const FALLBACK_TITLE = "Workshop";

export const Route = createFileRoute("/workshop/$id")({
  component: LiveRoomPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Workshop" },
      { name: "description", content: "A live Workshop. Drop in, talk shop, find your people." },
    ],
  }),
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
};

function LiveRoomPage() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [collabOpen, setCollabOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room } = useQuery({
    queryKey: ["instant-room", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id, title, kind, medium, category, host_user_id, promoted_at, source_workshop_id, status, focus_message, locked, ended_by_user_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Room | null;
    },
    refetchInterval: 5000,
  });

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
  const isHost = !!user && !!room && room.host_user_id === user.id;
  const isLeaderless = !!room && !room.host_user_id;
  const isPromoted = !!room?.promoted_at;
  const isEnded = !!room && room.status !== "active";

  // If the room is ended/archived and you're not the host, bounce home.
  // Host stays so they can wrap up gracefully.
  useEffect(() => {
    if (!room || isPromoted || isHost) return;
    if (isEnded) {
      toast("This Workshop ended.");
      router.navigate({ to: "/workshop" });
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

  // Other participants (for the host's Remove picker). Only fetched when host.
  const { data: participants = [] } = useQuery({
    queryKey: ["instant-room-participants", id, isHost],
    enabled: !!user && isHost,
    refetchInterval: 8000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from("instant_presence")
        .select("user_id, profile:profiles!instant_presence_user_id_fkey(display_name, username, avatar_url)")
        .eq("room_id", id)
        .gt("last_seen_at", cutoff);
      return ((data ?? []) as Array<{
        user_id: string;
        profile: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
      }>)
        .filter((p) => p.user_id !== user!.id)
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.profile?.display_name ?? null,
          username: p.profile?.username ?? null,
          avatar_url: p.profile?.avatar_url ?? null,
        }));
    },
  });

  const acceptInvite = useServerFn(acceptWorkshopJoinInvite);
  const declineInvite = useServerFn(declineWorkshopJoinInvite);

  async function onAcceptInvite() {
    if (!room?.source_workshop_id) return;
    try {
      const { workshopSlug } = await acceptInvite({ data: { workshopId: room.source_workshop_id } });
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link to="/workshop" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Workshop
        </Link>

        <h1 className="font-display text-xl md:text-2xl text-ink flex items-center gap-2 min-w-0">
          <span className="gradient-motion inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground shrink-0">
            <Coffee className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </h1>

        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span>Live · up to 5</span>
          {isHost && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-1.5 py-0.5 font-medium text-violet">
              <Crown className="h-3 w-3" /> Hosting
            </span>
          )}
          {isLeaderless && !isPromoted && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-ink-soft">Leaderless</span>
          )}
        </div>

        {!isPromoted && user && (
          <div className="ml-auto flex items-center gap-2">
            {!isHost && room?.status === "active" && (
              <HopButton
                roomId={id}
                medium={(room?.medium as any) ?? null}
                mode={mode ?? "video"}
              />
            )}
            {isHost && room && (
              <HostMenu
                roomId={id}
                hostUserId={user.id}
                title={room.title || FALLBACK_TITLE}
                focusMessage={room.focus_message}
                locked={!!room.locked}
                participants={participants}
                onChanged={() => qc.invalidateQueries({ queryKey: ["instant-room", id] })}
              />
            )}
            <Button
              size="sm"
              onClick={() => setCollabOpen(true)}
              className="rounded-full gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Create a Collab</span>
            </Button>
          </div>
        )}
      </div>

      {/* Hosted by + lock badge — sits just under the title row */}
      {!isPromoted && room?.host_user_id && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <HostedByLine hostUserId={room.host_user_id} />
          {room.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-ink-soft">
              Locked
            </span>
          )}
        </div>
      )}

      {/* Focus message — visible to everyone; host sees a ghost CTA when empty */}
      {!isPromoted && (
        <FocusStrip
          text={room?.focus_message ?? null}
          isHost={isHost}
          onHostSet={() => window.dispatchEvent(new CustomEvent("workshop:open-focus", { detail: { roomId: id } }))}
        />
      )}

      {/* Realtime listener for host broadcasts (mute_all, kick, ended) */}
      {user && <HostRoomEvents roomId={id} isHost={isHost} />}

      {/* Promoted banner — slim */}
      {isPromoted && forkedWs && (
        <div className="mt-3 rounded-xl border border-violet/30 bg-violet/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-violet shrink-0" />
            <span className="text-ink truncate">This Workshop became a Collab: "{forkedWs.title}".</span>
            <Link to="/workshops/$slug" params={{ slug: forkedWs.slug }} className="ml-auto">
              <Button size="sm" variant="outline" className="rounded-full gap-1 h-7">
                Open <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {invite && invite.status === "pending" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-violet/20 pt-2">
              <span className="text-xs text-ink-soft">You've been invited to join the persistent Workshop.</span>
              <Button size="sm" onClick={onAcceptInvite} className="rounded-full h-7">Join</Button>
              <Button size="sm" variant="ghost" onClick={onDeclineInvite} className="rounded-full h-7">No thanks</Button>
            </div>
          )}
        </div>
      )}

      <ChannelView
        key={id}
        roomId={id}
        title={title}
        initialMode={mode ?? "video"}
        toolsSlot={(media) => (
          <WorkshopToolsPanel
            scope={{
              kind: "instant",
              roomId: id,
              hostUserId: room?.host_user_id ?? null,
              category: (room?.category as any) ?? (room?.medium as any) ?? null,
            }}
            media={media}
          />
        )}

      />

      <WaitingForOthersCard
        roomId={id}
        visible={!isPromoted && liveCount <= 1}
        canPingMutuals={isHost}
      />

      <CreateCollabSheet
        open={collabOpen}
        onOpenChange={setCollabOpen}
        roomId={id}
        defaultTitle={title}
        onCreated={(slug) => {
          qc.invalidateQueries({ queryKey: ["instant-room", id] });
          router.navigate({ to: "/workshops/$slug", params: { slug } });
        }}
      />

      <HostFirstRunTour active={isHost && !isPromoted} />
    </main>
  );
}

function CreateCollabSheet({
  open, onOpenChange, roomId, defaultTitle, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomId: string;
  defaultTitle: string;
  onCreated: (workshopSlug: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createCollabFromRoom);

  useEffect(() => { if (open) { setTitle(defaultTitle); setPitch(""); } }, [open, defaultTitle]);

  async function submit() {
    if (!title.trim()) return toast.error("Give it a title");
    setBusy(true);
    try {
      const { workshopSlug } = await create({ data: { roomId, title: title.trim(), pitch: pitch.trim() || undefined } });
      if (!workshopSlug) throw new Error("Couldn't create the Collab");
      toast.success("Collab created — everyone in the room got an opt-in invite.");
      onOpenChange(false);
      onCreated(workshopSlug);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the Collab");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-violet" /> Create a Collab
          </DialogTitle>
          <DialogDescription>
            Fork this live Workshop into a persistent one. You'll be the host. Everyone currently in the room gets a one-tap invite — no one is auto-added.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">What is this Collab about?</label>
            <Textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={4} maxLength={2000}
              placeholder="A sentence or two so newcomers know what they're walking into."
              className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            <Rocket className="h-4 w-4" /> {busy ? "Creating…" : "Create Collab"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
