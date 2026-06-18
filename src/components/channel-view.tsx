import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, X, Maximize2 } from "lucide-react";
import { useWorkshopPip, PopOutButton } from "@/components/workshop-pip";
import { HopButton } from "@/components/hop-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import {
  MediaPanel,
  VideoStage,
  FullscreenRoom,
  VideoTile,
  AudioTile,
  type RoomViewMode,
} from "@/components/media-panel";
import { useMediaRoom, type MediaMode } from "@/hooks/use-media-room";
import { joinLounge } from "@/lib/instant.functions";
import { sendChatMessage } from "@/lib/chat.functions";
import { purgeRoomWhiteboard } from "@/lib/room-views.functions";
import { WorkPeek } from "@/components/work-peek";
import { RoomGallery } from "@/components/room-gallery";
import { FullscreenShell } from "@/components/fullscreen-shell";
import { WorkshopCollabsPanel } from "@/components/workshop-collabs-panel";
import { ChatPolls } from "@/components/chat-polls";
import {
  ChatMentionInput,
  MessageBody,
  type MentionCandidate,
} from "@/components/chat-mention-input";
import {
  ReactionAddButton,
  ReactionPills,
  type ReactionRow,
} from "@/components/chat-message-reactions";

// Board moved to Workshop Tools; live room no longer mounts RoomBoard.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  mentions?: string[] | null;
};
type Presence = {
  user_id: string;
  last_seen_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

const QUIET_WARN_MS = 2 * 60 * 1000;
const QUIET_KICK_MS = 60 * 1000;

export function ChannelView({
  roomId,
  title,
  pinned,
  initialMode = "voice",
  workshopId,
  hostUserId,
  toolsSlot,
}: {
  roomId: string;
  title: string;
  pinned?: React.ReactNode;
  initialMode?: MediaMode;
  workshopId?: string;
  hostUserId?: string | null;
  toolsSlot?: React.ReactNode | ((media: ReturnType<typeof useMediaRoom>) => React.ReactNode);
}) {

  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [fsView, setFsView] = useState<null | "chat" | "gallery">(null);
  const [endedOpen, setEndedOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [joiningNew, setJoiningNew] = useState(false);
  const aloneTimerRef = useRef<number | null>(null);
  const multiPartySinceRef = useRef<number | null>(null);
  const adminDismissedRef = useRef(false);
  const [viewMode, setViewMode] = useState<RoomViewMode>("chat");
  const [peekWorkId, setPeekWorkId] = useState<string | null>(null);
  const [workPeekOpen, setWorkPeekOpen] = useState(false);
  const openWork = (id: string) => {
    setPeekWorkId(id);
    setWorkPeekOpen(true);
  };
  const dropNew = useServerFn(joinLounge);
  const purgeBoard = useServerFn(purgeRoomWhiteboard);
  const sendMessage = useServerFn(sendChatMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const media = useMediaRoom(roomId);

  // The lobby "Drop in" button is the consent point — auto-join with mic + camera
  // (or whatever mode was requested via ?mode=) as soon as the user is loaded.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (!user || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    media.setMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // If join fails, route back to /instant.
  useEffect(() => {
    if (autoJoinedRef.current && media.error && !media.joined && !media.busy) {
      toast.error(media.error);
      router.navigate({ to: "/workshop" });
    }
  }, [media.error, media.joined, media.busy, router]);

  function handleExit() {
    // If I'm the last one here, purge the ephemeral whiteboard for this room.
    if (media.joined && media.count <= 1) {
      purgeBoard({ data: { roomId } }).catch(() => {});
    }
    media.leave();
    router.navigate({ to: "/" });
  }

  // Esc exits fullscreen.
  useEffect(() => {
    if (!fsView) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFsView(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fsView]);

  // Inactivity guard: muted AND camera off → warn at 2 min, drop 1 min later.
  // Suppressed while the "workshop wrapped" prompt is open.
  const inactive = media.joined && media.muted && !media.cameraOn && !endedOpen;
  useEffect(() => {
    if (!inactive) {
      setWarnOpen(false);
      return;
    }
    const warnT = setTimeout(() => setWarnOpen(true), QUIET_WARN_MS);
    return () => clearTimeout(warnT);
  }, [inactive]);

  useEffect(() => {
    if (!warnOpen) return;
    const kickT = setTimeout(() => {
      if (inactive) {
        toast.error("Dropped from the Workshop — you went quiet.");
        media.leave();
        router.navigate({ to: "/workshop" });
      }
    }, QUIET_KICK_MS);
    return () => clearTimeout(kickT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warnOpen, inactive]);

  // Track first moment the room became multi-party (>=2). Used to gate auto-end:
  // a solo first-joiner should never be wrapped — only fire after a real
  // session existed and has been live for 5+ minutes.
  useEffect(() => {
    if (media.joined && media.count >= 2 && multiPartySinceRef.current === null) {
      multiPartySinceRef.current = Date.now();
    }
  }, [media.joined, media.count]);

  // "Workshop wrapped" — only when the user has been alone after a real
  // multi-party session that's at least 5 minutes old, and an admin hasn't
  // dismissed it for this alone-stretch.
  const alone = media.joined && media.count <= 1;
  const MIN_SESSION_MS = 5 * 60 * 1000;
  useEffect(() => {
    if (!alone) {
      // Reset admin dismissal so future empties can re-trigger normally.
      adminDismissedRef.current = false;
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
      if (endedOpen) {
        setEndedOpen(false);
        setSecondsLeft(30);
      }
      return;
    }
    const eligible =
      multiPartySinceRef.current !== null &&
      Date.now() - multiPartySinceRef.current >= MIN_SESSION_MS &&
      !adminDismissedRef.current;
    if (!eligible) return;
    if (endedOpen || aloneTimerRef.current) return;
    aloneTimerRef.current = window.setTimeout(() => {
      aloneTimerRef.current = null;
      setSecondsLeft(30);
      setEndedOpen(true);
    }, 1000);
    return () => {
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
    };
  }, [alone, endedOpen]);

  // 30s countdown while the prompt is open → auto-forward to home.
  // Admins are never force-routed: on tick to 0 we just dismiss the dialog.
  useEffect(() => {
    if (!endedOpen) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (isAdmin) {
            adminDismissedRef.current = true;
            setEndedOpen(false);
            setSecondsLeft(30);
          } else {
            handleExit();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endedOpen, isAdmin]);

  function dismissEnded() {
    adminDismissedRef.current = true;
    setEndedOpen(false);
    setSecondsLeft(30);
  }

  async function handleJoinNew() {
    if (joiningNew) return;
    setJoiningNew(true);
    const nextMode: MediaMode = media.cameraOn || media.mode === "video" ? "video" : "voice";
    try {
      media.leave();
      const { roomId: newId } = await dropNew();
      setEndedOpen(false);
      router.navigate({ to: "/workshop/$id", params: { id: newId }, search: { mode: nextMode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't find a new Workshop");
      setJoiningNew(false);
      router.navigate({ to: "/workshop" });
    }
  }

  useEffect(() => {
    if (!user) return;
    // No gate — joined the moment the user dropped in from the lobby.
    let cancelled = false;

    async function join() {
      await supabase.from("instant_presence").upsert({
        room_id: roomId,
        user_id: user!.id,
        status: "active",
        last_seen_at: new Date().toISOString(),
      });
      const [msgs, pres, reax] = await Promise.all([
        supabase
          .from("instant_messages")
          .select("id,user_id,body,created_at,mentions")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase
          .from("instant_presence")
          .select(
            "user_id,last_seen_at,profile:profiles!instant_presence_user_id_fkey(display_name,username,avatar_url)",
          )
          .eq("room_id", roomId),
        supabase
          .from("instant_message_reactions")
          .select("id,message_id,user_id,emoji")
          .eq("room_id", roomId),
      ]);
      if (cancelled) return;
      setMessages((msgs.data ?? []) as Message[]);
      setPresence((pres.data ?? []) as unknown as Presence[]);
      setReactions((reax.data ?? []) as ReactionRow[]);
    }
    join();

    const channel = supabase
      .channel(`instant:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instant_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => setMessages((prev) => [...prev, p.new as Message]),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instant_message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (p) =>
          setReactions((prev) => {
            const next = p.new as ReactionRow;
            if (prev.some((r) => r.id === next.id)) return prev;
            return [...prev, next];
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "instant_message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => setReactions((prev) => prev.filter((r) => r.id !== (p.old as ReactionRow).id)),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instant_presence",
          filter: `room_id=eq.${roomId}`,
        },
        async (p) => {
          const newRow = p.new as Presence;
          const { data } = await supabase
            .from("profiles")
            .select("display_name,username,avatar_url")
            .eq("id", newRow.user_id)
            .maybeSingle();
          setPresence((prev) =>
            prev.find((x) => x.user_id === newRow.user_id)
              ? prev
              : [...prev, { ...newRow, profile: data }],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "instant_presence",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => setPresence((prev) => prev.filter((x) => x.user_id !== (p.old as Presence).user_id)),
      )
      .on("broadcast", { event: "follow" }, (msg) => {
        const payload = msg.payload as { followed_id: string; display_name: string };
        if (payload?.followed_id === user!.id) {
          toast.success(`${payload.display_name} followed you`, {
            icon: <UserPlus className="h-4 w-4 text-primary" />,
          });
        }
      })
      .subscribe();

    const heartbeat = setInterval(() => {
      supabase
        .from("instant_presence")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }, 30_000);

    function leave() {
      supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user!.id);
    }
    window.addEventListener("beforeunload", leave);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [roomId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function submitChat(mentions: string[]) {
    if (!user || !draft.trim()) return;
    setSending(true);
    const body = draft.trim().slice(0, 1000);
    setDraft("");
    try {
      await sendMessage({ data: { roomId, body, mentions } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send message");
    } finally {
      setSending(false);
    }
  }

  // Fullscreen chat panel still uses a plain form signature; extract mentions
  // by re-parsing the current draft against the live presence list.
  async function sendFromForm(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const ids = new Set<string>();
    const re = /(?:^|\s)@([A-Za-z0-9_]{1,30})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const handle = m[1].toLowerCase();
      const p = presence.find((pp) => (pp.profile?.username ?? "").toLowerCase() === handle);
      if (p) ids.add(p.user_id);
    }
    await submitChat(Array.from(ids));
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    const mine = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji,
    );
    if (mine) {
      // Optimistic remove
      setReactions((prev) => prev.filter((r) => r.id !== mine.id));
      const { error } = await supabase
        .from("instant_message_reactions")
        .delete()
        .eq("id", mine.id);
      if (error) {
        setReactions((prev) => [...prev, mine]);
        toast.error(error.message);
      }
    } else {
      const tempId = `temp-${Math.random().toString(36).slice(2)}`;
      const optimistic: ReactionRow = { id: tempId, message_id: messageId, user_id: user.id, emoji };
      setReactions((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from("instant_message_reactions")
        .insert({ message_id: messageId, room_id: roomId, user_id: user.id, emoji })
        .select("id,message_id,user_id,emoji")
        .single();
      setReactions((prev) => prev.filter((r) => r.id !== tempId));
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setReactions((prev) =>
          prev.some((r) => r.id === (data as any).id) ? prev : [...prev, data as ReactionRow],
        );
      }
    }
  }

  const profileLookup = useMemo(
    () =>
      new Map(
        presence.map((p) => [
          p.user_id,
          {
            user_id: p.user_id,
            display_name: p.profile?.display_name ?? null,
            username: p.profile?.username ?? null,
            avatar_url: p.profile?.avatar_url ?? null,
          },
        ]),
      ),
    [presence],
  );

  const mentionCandidates = useMemo<MentionCandidate[]>(
    () =>
      presence
        .filter((p) => !!p.profile?.username)
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.profile?.display_name ?? null,
          username: p.profile?.username ?? null,
          avatar_url: p.profile?.avatar_url ?? null,
        })),
    [presence],
  );

  const me = user ? profileLookup.get(user.id) : undefined;
  const meDisplay = me?.display_name || me?.username || "You";
  const meAvatar = me?.avatar_url ?? null;
  const pip = useWorkshopPip({ media, meDisplay, profileLookup });
  const others = useMemo(
    () => presence.filter((p) => p.user_id !== user?.id),
    [presence, user?.id],
  );

  const galleryMembers = useMemo(
    () =>
      user
        ? [
            {
              user_id: user.id,
              display_name: meDisplay,
              username: me?.username ?? null,
              avatar_url: meAvatar,
              speaking: media.speaking && !media.muted,
            },
            ...others.map((o) => ({
              user_id: o.user_id,
              display_name: o.profile?.display_name ?? null,
              username: o.profile?.username ?? null,
              avatar_url: o.profile?.avatar_url ?? null,
              speaking: !!media.peers.find((p) => p.userId === o.user_id)?.speaking,
            })),
          ]
        : [],
    [user, meDisplay, me?.username, meAvatar, media.speaking, media.muted, media.peers, others],
  );

  // Live participant strip rendered inside Board/Gallery fullscreen so the
  // user can still see who is in the room while focused on the surface.
  const presenceStrip = user ? (
    <>
      {media.cameraOn && media.localStream ? (
        <div className="w-40 shrink-0">
          <VideoTile
            stream={media.localStream}
            label={`${meDisplay} (you)`}
            muted
            speaking={media.speaking && !media.muted}
            mirrored
          />
        </div>
      ) : (
        <div className="w-40 shrink-0">
          <AudioTile
            displayName={`${meDisplay} (you)`}
            avatarUrl={meAvatar}
            speaking={media.speaking && !media.muted}
            muted={media.muted}
          />
        </div>
      )}
      {others.map((o) => {
        const peer = media.peers.find((p) => p.userId === o.user_id);
        const name = o.profile?.display_name || o.profile?.username || "Anon";
        if (peer && peer.mode === "video" && peer.stream) {
          return (
            <div key={o.user_id} className="w-40 shrink-0">
              <VideoTile stream={peer.stream} label={name} speaking={peer.speaking} />
            </div>
          );
        }
        return (
          <div key={o.user_id} className="w-40 shrink-0">
            <AudioTile
              displayName={name}
              avatarUrl={o.profile?.avatar_url ?? null}
              speaking={!!peer?.speaking}
              muted={false}
            />
          </div>
        );
      })}
    </>
  ) : null;

  // The persistent top-right expand button maps to whichever surface is active.
  const fsTarget: "chat" | "gallery" =
    viewMode === "gallery" ? "gallery" : "chat";
  const fsLabel =
    fsTarget === "gallery" ? "Expand Work" : "Expand chat";


  return (
    <>
      {fsView === "chat" && user && (
        <FullscreenRoom
          m={media}
          channelTitle={title}
          meDisplay={meDisplay}
          meAvatar={meAvatar}
          meUserId={user.id}
          others={others}
          profileLookup={profileLookup}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          onSend={sendFromForm}
          sending={sending}
          onExit={handleExit}
          onMinimize={() => setFsView(null)}
          roomId={roomId}
          stageSlot={typeof toolsSlot === "function" ? toolsSlot(media) : toolsSlot}
          dockExtra={
            <HopButton
              roomId={roomId}
              medium={null}
              mode={media.cameraOn || media.mode === "video" ? "video" : "voice"}
            />
          }
        />
      )}
      {/* Board moved to Workshop Tools — no fullscreen board view in live room. */}
      {fsView === "gallery" && user && (
        <FullscreenShell
          title={`${title} · Work`}
          presence={presenceStrip}
          onMinimize={() => setFsView(null)}
        >
          <RoomGallery
            meUserId={user.id}
            members={galleryMembers}
            roomId={roomId}
            hostUserId={hostUserId ?? null}
            onOpenWork={openWork}
            className="h-full"
            fullscreen
          />
        </FullscreenShell>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="relative flex flex-col rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
          {pinned && (
            <div className="border-b border-border bg-muted/40 px-4 py-3 md:px-6">{pinned}</div>
          )}
          {/* Persistent contextual expand — always available, routes to the active surface. */}
          <PopOutButton onClick={pip.open} supported={pip.supported} isOpen={pip.isOpen} />
          {pip.portal}
          <button
            type="button"
            onClick={() => setFsView(fsTarget)}
            className="absolute right-3 top-3 z-20 rounded-full bg-background/90 p-1.5 text-ink shadow-sm ring-1 ring-border hover:bg-background"
            aria-label={fsLabel}
            title={fsLabel}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <VideoStage m={media} meDisplay={meDisplay} profileLookup={profileLookup} />
          {viewMode === "tools" ? (
            <div className="h-[60vh] overflow-y-auto p-3 md:p-4">
              {(typeof toolsSlot === "function" ? toolsSlot(media) : toolsSlot) ?? (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                  No tools available in this room.
                </div>
              )}
            </div>

          ) : viewMode === "collabs" && user ? (
            <div className="h-[60vh] overflow-y-auto p-3 md:p-4">
              <WorkshopCollabsPanel
                roomId={roomId}
                hostUserId={hostUserId ?? null}
                presenceUsers={[
                  {
                    user_id: user.id,
                    display_name: meDisplay,
                    username: me?.username ?? null,
                    avatar_url: meAvatar,
                  },
                  ...others.map((o) => ({
                    user_id: o.user_id,
                    display_name: o.profile?.display_name ?? null,
                    username: o.profile?.username ?? null,
                    avatar_url: o.profile?.avatar_url ?? null,
                  })),
                ]}
              />
            </div>
          ) : viewMode === "gallery" && user ? (
            <div className="h-[60vh] p-3 md:p-4">
              {fsView === "gallery" ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface text-ink-muted text-sm">
                  Work open in fullscreen…
                </div>
              ) : (
                <RoomGallery
                  meUserId={user.id}
                  members={galleryMembers}
                  roomId={roomId}
                  hostUserId={hostUserId ?? null}
                  onOpenWork={openWork}
                  className="h-full"
                />
              )}
            </div>
          ) : (
            <>
              {workshopId && <ChatPolls workshopId={workshopId} />}
              <div ref={scrollRef} className="h-[60vh] overflow-y-auto px-4 py-4 md:px-6">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="font-display text-xl text-ink">Quiet in {title}.</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        Be the first to say hi. Messages vanish after 24h.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    <AnimatePresence initial={false}>
                      {messages.map((m) => {
                        const p = presence.find((pp) => pp.user_id === m.user_id)?.profile;
                        const mine = m.user_id === user?.id;
                        const mentionsMe = !!user && (m.mentions ?? []).includes(user.id);
                        const msgReactions = reactions.filter((r) => r.message_id === m.id);
                        return (
                          <motion.li
                            key={m.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
                          >
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted text-[10px] flex items-center justify-center text-ink-muted">
                              {p?.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                p?.display_name?.[0] || "?"
                              )}
                            </div>
                            <div className={`flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
                              <div
                                className={`rounded-2xl px-3 py-2 text-sm ${
                                  mentionsMe && !mine
                                    ? "bg-primary/10 ring-1 ring-primary/40 text-ink"
                                    : mine
                                      ? "bg-ink text-background"
                                      : "bg-muted text-ink"
                                }`}
                              >
                                {!mine && p && (
                                  <div className="text-[10px] font-medium opacity-70 mb-0.5">
                                    {p.display_name || p.username}
                                  </div>
                                )}
                                <MessageBody
                                  body={m.body}
                                  participants={mentionCandidates}
                                  meUsername={me?.username ?? null}
                                />
                              </div>
                              <div className={`mt-1 flex items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                                <ReactionAddButton onToggle={(e) => toggleReaction(m.id, e)} />
                                <ReactionPills
                                  reactions={msgReactions}
                                  meUserId={user?.id}
                                  onToggle={(e) => toggleReaction(m.id, e)}
                                />
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
              <ChatMentionInput
                draft={draft}
                setDraft={setDraft}
                onSubmit={submitChat}
                sending={sending}
                placeholder={`Say something in ${title}…`}
                participants={mentionCandidates}
                className="border-t border-border p-3"
              />
            </>
          )}
        </div>

        <div className="space-y-4">
          <MediaPanel
            m={media}
            channelTitle={title}
            meDisplay={meDisplay}
            meAvatar={meAvatar}
            meUserId={user?.id ?? ""}
            profileLookup={profileLookup}
            others={others}
            onExit={handleExit}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenWork={openWork}
            roomId={roomId}
            dockExtra={
              <HopButton
                roomId={roomId}
                medium={null}
                mode={media.cameraOn || media.mode === "video" ? "video" : "voice"}
              />
            }
          />

          {/* Collabs moved into the main view toggle — sidebar is media-only now. */}
        </div>

        <WorkPeek workId={peekWorkId} open={workPeekOpen} onOpenChange={setWorkPeekOpen} />

        <AlertDialog open={warnOpen} onOpenChange={setWarnOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Still here?</AlertDialogTitle>
              <AlertDialogDescription>
                You've been muted with camera off for 2 minutes. Tap Stay or unmute — otherwise
                we'll drop you in 1 minute.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setWarnOpen(false)}>Stay</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={endedOpen}
          onOpenChange={(o) => {
            if (!o && isAdmin) dismissEnded();
          }}
        >
          <AlertDialogContent className="relative">
            {isAdmin && (
              <button
                type="button"
                onClick={dismissEnded}
                aria-label="Dismiss"
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <AlertDialogHeader>
              <AlertDialogTitle>Workshop wrapped</AlertDialogTitle>
              <AlertDialogDescription>
                You're the only one left. Want to drop into a new Workshop?
                <br />
                <span className="mt-2 inline-block text-ink-muted">
                  Returning home in <span className="font-medium text-ink">{secondsLeft}s</span>…
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleExit} disabled={joiningNew}>
                Back to home
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleJoinNew} disabled={joiningNew}>
                {joiningNew ? "Finding a seat…" : "Join new Workshop"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
