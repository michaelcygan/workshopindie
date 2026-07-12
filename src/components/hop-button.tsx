import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinLounge, joinMediumLounge } from "@/lib/instant.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markRecentExit, recentExitIds } from "@/lib/recent-rooms";
import { toast } from "sonner";
import type { Category } from "@/lib/categories";

type Props = {
  roomId: string;
  medium: Category | null;
  mode: "video" | "voice";
};

/**
 * "Hop to next Workshop" — matchmaker call that excludes the current room
 * plus any recently-exited rooms. Drops presence in the current room before
 * navigating so the previous room reflects the exit immediately.
 */
export function HopButton({ roomId, medium, mode }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const drop = useServerFn(joinLounge);
  const dropMedium = useServerFn(joinMediumLounge);
  const [busy, setBusy] = useState(false);

  async function onHop() {
    if (busy || !user) return;
    setBusy(true);
    try {
      const exclude = Array.from(new Set([roomId, ...recentExitIds()]));
      const res = medium
        ? await dropMedium({ data: { medium, excludeRoomIds: exclude } })
        : await drop({ data: { excludeRoomIds: exclude } });
      if (!res?.roomId || res.roomId === roomId) {
        toast("No other rooms right now.", {
          description: "You're the only one live in this medium — try a different one.",
        });
        return;
      }
      // Drop presence in the room we're leaving so it updates instantly.
      markRecentExit(roomId);
      await supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user.id);
      router.navigate({ to: "/lounge/$id", params: { id: res.roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't skip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onHop}
      disabled={busy}
      className="rounded-full gap-1.5"
      title="Find another live Lounge"
      aria-label="Go to next Lounge"
      data-hop-button
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{busy ? "Finding…" : "Next Lounge"}</span>
    </Button>
  );
}
