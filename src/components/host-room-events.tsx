import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { joinLounge } from "@/lib/instant.functions";
import { markRecentExit, recentExitIds } from "@/lib/recent-rooms";
import { toast } from "sonner";

/**
 * Single subscribed Realtime channel per room for host-driven broadcasts.
 * Exposed so HostMenu can `.send()` on the same subscribed channel instead
 * of spinning up a fresh (unsubscribed) one per call.
 */
const channelByRoom = new Map<string, RealtimeChannel>();

function getHostChannel(roomId: string): RealtimeChannel {
  let ch = channelByRoom.get(roomId);
  if (ch) return ch;
  ch = supabase.channel(`instant-host:${roomId}`);
  channelByRoom.set(roomId, ch);
  return ch;
}

export function sendHostEvent(roomId: string, event: string, payload: Record<string, unknown> = {}) {
  const ch = getHostChannel(roomId);
  ch.send({ type: "broadcast", event, payload }).catch(() => {});
}

/**
 * Subscribes to host-driven broadcast events for an instant room:
 * - `mute_all` → advisory toast asking the guest to mute.
 * - `kick`    → if the payload targets the current user, leave and offer "Find another".
 * - `ended`   → toast that the host ended; route to /workshop with "Find another".
 */
export function HostRoomEvents({ roomId, isHost }: { roomId: string; isHost: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const drop = useServerFn(joinLounge);
  const dropRef = useRef(drop);
  dropRef.current = drop;

  async function findAnother() {
    try {
      const exclude = Array.from(new Set([roomId, ...recentExitIds()]));
      const res = await dropRef.current({ data: { excludeRoomIds: exclude } });
      if (res?.roomId && res.roomId !== roomId) {
        router.navigate({ to: "/lounge/$id", params: { id: res.roomId }, search: { mode: "video" } });
      } else {
        router.navigate({ to: "/lounge" });
      }
    } catch {
      router.navigate({ to: "/lounge" });
    }
  }

  useEffect(() => {
    if (!user) return;
    const ch = getHostChannel(roomId);
    ch.on("broadcast", { event: "mute_all" }, () => {
      if (isHost) return;
      toast("The host asked everyone to mute.", {
        duration: 6000,
        description: "Tap your mic button to mute.",
      });
    });
    ch.on("broadcast", { event: "kick" }, (msg) => {
      const target = (msg.payload as { target_user_id?: string } | undefined)?.target_user_id;
      if (target && target === user.id) {
        markRecentExit(roomId);
        supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user.id);
        toast.error("The host removed you from this Lounge.", {
          action: { label: "Find another", onClick: findAnother },
        });
        router.navigate({ to: "/workshop" });
      }
    });
    ch.on("broadcast", { event: "ended" }, () => {
      if (isHost) return;
      markRecentExit(roomId);
      supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user.id);
      toast("The host ended this Lounge.", {
        action: { label: "Find another", onClick: findAnother },
      });
      qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
      router.navigate({ to: "/workshop" });
    });
    ch.subscribe();

    return () => {
      // Tear down on unmount and forget so the next mount resubscribes cleanly.
      supabase.removeChannel(ch);
      channelByRoom.delete(roomId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, isHost]);

  return null;
}
