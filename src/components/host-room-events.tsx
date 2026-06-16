import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Subscribes to host-driven broadcast events for an instant room:
 * - `mute_all` → toast asking the guest to mute (does NOT force-mute).
 * - `kick` → if the payload targets the current user, leave and toast.
 * - `ended` → toast that the host ended the room; the room status update
 *   will reach the room query and route everyone to the wrap screen.
 */
export function HostRoomEvents({ roomId, isHost }: { roomId: string; isHost: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`instant-host:${roomId}`)
      .on("broadcast", { event: "mute_all" }, () => {
        if (isHost) return;
        toast("The host asked everyone to mute.", {
          duration: 6000,
          action: {
            label: "Mute me",
            onClick: () => {
              // Best-effort: hands off to the mic toggle in the page chrome.
              document.querySelector<HTMLButtonElement>("[data-mic-toggle]")?.click();
            },
          },
        });
      })
      .on("broadcast", { event: "kick" }, (msg) => {
        const target = (msg.payload as { target_user_id?: string } | undefined)?.target_user_id;
        if (target && target === user.id) {
          supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user.id);
          toast.error("The host removed you from this Workshop.");
          router.navigate({ to: "/workshop" });
        }
      })
      .on("broadcast", { event: "ended" }, () => {
        if (isHost) return;
        toast("The host ended this Workshop.");
        qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, isHost, router, qc]);

  return null;
}
