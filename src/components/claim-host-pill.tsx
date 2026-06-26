import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RadioTower } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startHostClaim, objectHostClaim, finalizeHostClaim } from "@/lib/host-room.functions";

const CLAIM_WINDOW_MS = 10_000;
const DWELL_REQUIRED_MS = 60_000;

type Props = {
  roomId: string;
  viewerId: string;
  /** Truthy when this room is workshop-paired or otherwise un-claimable. */
  unclaimable?: boolean;
  claimUserId: string | null;
  claimStartedAt: string | null;
  claimantName?: string | null;
  onChanged?: () => void;
};

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ClaimHostPill({
  roomId,
  viewerId,
  unclaimable,
  claimUserId,
  claimStartedAt,
  claimantName,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const start = useServerFn(startHostClaim);
  const object = useServerFn(objectHostClaim);
  const finalize = useServerFn(finalizeHostClaim);

  // Viewer's own dwell — how long they've been in the room.
  const { data: firstSeen } = useQuery({
    queryKey: ["instant-presence-self", roomId, viewerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("instant_presence")
        .select("first_seen_at")
        .eq("room_id", roomId)
        .eq("user_id", viewerId)
        .maybeSingle();
      return data?.first_seen_at ? new Date(data.first_seen_at as string).getTime() : null;
    },
    refetchInterval: 15_000,
  });

  // Cooldown row, if any.
  const { data: cooldownUntil } = useQuery({
    queryKey: ["claim-cooldown", roomId, viewerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("instant_room_claim_cooldowns")
        .select("until")
        .eq("room_id", roomId)
        .eq("user_id", viewerId)
        .maybeSingle();
      return data?.until ? new Date(data.until).getTime() : null;
    },
    refetchInterval: 30_000,
  });

  const now = useNow(500);
  const claimStartMs = claimStartedAt ? new Date(claimStartedAt).getTime() : null;
  const inWindow = !!claimStartMs && now - claimStartMs < CLAIM_WINDOW_MS;
  const remainingSec = claimStartMs
    ? Math.max(0, Math.ceil((CLAIM_WINDOW_MS - (now - claimStartMs)) / 1000))
    : 0;

  const isClaimant = !!claimUserId && claimUserId === viewerId;
  const dwellOk = !!firstSeen && now - firstSeen >= DWELL_REQUIRED_MS;
  const cooldownActive = !!cooldownUntil && cooldownUntil > now;

  // Once the window lapses and viewer was the claimant, finalize.
  const finalizedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isClaimant || inWindow || !claimStartMs) return;
    const key = `${roomId}:${claimStartMs}`;
    if (finalizedRef.current === key) return;
    finalizedRef.current = key;
    finalize({ data: { roomId } })
      .catch(() => {})
      .finally(() => {
        qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
        onChanged?.();
      });
  }, [isClaimant, inWindow, claimStartMs, roomId, finalize, qc, onChanged]);

  const dwellHint = useMemo(() => {
    if (!firstSeen) return "Join the room first";
    const secs = Math.max(0, Math.ceil((DWELL_REQUIRED_MS - (now - firstSeen)) / 1000));
    return secs > 0 ? `Hang out ${secs}s more to claim` : "Claim host";
  }, [firstSeen, now]);

  if (unclaimable) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-ink-soft opacity-80"
        title="This Lounge already has managed rights"
      >
        <RadioTower className="h-3 w-3" /> Claim Host
      </button>
    );
  }

  // Pending claim — show contest UI to non-claimants, "Confirming…" to the claimant.
  if (inWindow) {
    if (isClaimant) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-1.5 py-0.5 font-medium text-violet">
          <RadioTower className="h-3 w-3" /> Confirming… ({remainingSec}s)
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await object({ data: { roomId } });
            toast.success("You vetoed the claim.");
          } catch (e: any) {
            toast.error(e?.message ?? "Couldn't object");
          } finally {
            qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
            onChanged?.();
          }
        }}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-ink hover:shadow-soft transition"
      >
        {claimantName ?? "Someone"} wants to host · Object ({remainingSec}s)
      </button>
    );
  }

  if (!dwellOk || cooldownActive) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-ink-soft opacity-80"
        title={cooldownActive ? "Try again in a few minutes" : dwellHint}
      >
        <RadioTower className="h-3 w-3" /> Claim Host
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await start({ data: { roomId } });
          toast("Claiming host — others have 10s to object.");
        } catch (e: any) {
          toast.error(e?.message ?? "Couldn't claim");
        } finally {
          qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
          onChanged?.();
        }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 hover:border-primary/60 hover:shadow-soft transition"
    >
      <RadioTower className="h-3 w-3" /> Claim Host
    </button>
  );
}
