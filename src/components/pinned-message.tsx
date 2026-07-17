import { useEffect, useState } from "react";
import { Pin, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setRoomPin } from "@/lib/host-room.functions";
import { MessageBody, type MentionCandidate } from "@/components/chat-mention-input";
import { UsernameMention } from "@/components/username-mention";
import { ProfilePeek } from "@/components/profile-peek";

/** Subscribes to a room's pinned-message state via realtime. */
export function useRoomPin(roomId: string) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [pinnedBy, setPinnedBy] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("instant_rooms")
        .select("pinned_message_id, pinned_by_user_id")
        .eq("id", roomId)
        .maybeSingle();
      if (cancelled) return;
      setPinnedId((data as any)?.pinned_message_id ?? null);
      setPinnedBy((data as any)?.pinned_by_user_id ?? null);
    })();
    const ch = supabase
      .channel(`room-pin:${roomId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "instant_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as any;
          setPinnedId(row?.pinned_message_id ?? null);
          setPinnedBy(row?.pinned_by_user_id ?? null);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [roomId]);
  return { pinnedId, pinnedBy };
}


type Msg = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  mentions?: string[] | null;
};

type Profile = {
  user_id?: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type Props = {
  roomId: string;
  messages: Msg[];
  profileLookup: Map<string, Profile>;
  mentionCandidates: MentionCandidate[];
  meUsername: string | null;
  meUserId: string | null;
};

/** Renders the single pinned chat message at the top of the chat stream. */
export function PinnedMessage({
  roomId,
  messages,
  profileLookup,
  mentionCandidates,
  meUsername,
  meUserId,
}: Props) {
  const { pinnedId, pinnedBy } = useRoomPin(roomId);
  const setPin = useServerFn(setRoomPin);
  const [busy, setBusy] = useState(false);

  if (!pinnedId) return null;
  const msg = messages.find((m) => m.id === pinnedId);
  if (!msg) return null;
  const p = profileLookup.get(msg.user_id);
  const canUnpin = !!meUserId && pinnedBy === meUserId;


  const onUnpin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setPin({ data: { roomId, messageId: null } });
      toast.success("Unpinned");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't unpin");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
      <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-ink-muted">
          <span className="uppercase tracking-wide">Pinned</span>
          {p && (
            <>
              <span>·</span>
              <ProfilePeek userId={msg.user_id}>
                <button type="button" className="font-medium hover:underline">
                  {p.display_name || p.username || "member"}
                </button>
              </ProfilePeek>
            </>
          )}
        </div>
        <div className="text-sm text-ink">
          <MessageBody
            body={msg.body}
            participants={mentionCandidates}
            meUsername={meUsername}
            renderMention={({ user: mu, children }) => (
              <ProfilePeek userId={mu.user_id}>{children}</ProfilePeek>
            )}
            renderUnknownMention={({ handle, children }) => (
              <UsernameMention handle={handle}>{children}</UsernameMention>
            )}
          />
        </div>
      </div>
      {canUnpin && (
        <button
          type="button"
          onClick={onUnpin}
          disabled={busy}
          className="ml-1 rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink disabled:opacity-50"
          aria-label="Unpin message"
          title="Unpin"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Small pin/unpin action button used in each message row. */
export function PinMessageButton({
  roomId,
  messageId,
  isPinned,
  disabled,
}: {
  roomId: string;
  messageId: string;
  isPinned: boolean;
  disabled?: boolean;
}) {
  const setPin = useServerFn(setRoomPin);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await setPin({ data: { roomId, messageId: isPinned ? null : messageId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update pin");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={
        "rounded-full p-1 text-ink-muted transition hover:bg-muted hover:text-ink disabled:opacity-50 " +
        (isPinned ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-60 md:opacity-0")
      }
      aria-label={isPinned ? "Unpin message" : "Pin message"}
      title={isPinned ? "Unpin" : "Pin"}
    >
      <Pin className={"h-3.5 w-3.5 " + (isPinned ? "fill-current" : "")} />
    </button>
  );
}
