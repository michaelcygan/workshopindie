import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startHostClaim } from "@/lib/host-room.functions";

// Simple deterministic hash → [0,1)
function seededRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

type Props = {
  roomId: string;
  viewerId: string;
  /** True only when room has no host AND no in-flight claim AND status active. */
  isEligibleRoom: boolean;
};

export function BecomeHostNudge({ roomId, viewerId, isEligibleRoom }: Props) {
  const qc = useQueryClient();
  const claim = useServerFn(startHostClaim);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!window.sessionStorage.getItem(`host-nudge:${roomId}`);
  });

  // Present attendees in the last 60s.
  const { data: present = [] } = useQuery({
    queryKey: ["become-host-present", roomId],
    enabled: isEligibleRoom && !dismissed,
    refetchInterval: 30_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from("instant_presence")
        .select("user_id, first_seen_at, last_seen_at")
        .eq("room_id", roomId)
        .gt("last_seen_at", cutoff);
      return (data ?? []) as Array<{ user_id: string; first_seen_at: string; last_seen_at: string }>;
    },
  });

  // Last actor: most recent message author, or freshest joiner in last 5min.
  const { data: lastActorId } = useQuery({
    queryKey: ["become-host-last-actor", roomId],
    enabled: isEligibleRoom && !dismissed,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: msg } = await supabase
        .from("workshop_messages")
        .select("user_id, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data: joiner } = await supabase
        .from("instant_presence")
        .select("user_id, first_seen_at")
        .eq("room_id", roomId)
        .gt("first_seen_at", since)
        .order("first_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const msgTs = msg?.created_at ? new Date(msg.created_at).getTime() : 0;
      const joinTs = joiner?.first_seen_at ? new Date(joiner.first_seen_at).getTime() : 0;
      if (msgTs === 0 && joinTs === 0) return null;
      return (msgTs >= joinTs ? msg?.user_id : joiner?.user_id) ?? null;
    },
  });

  // Viewer's own dwell
  const myFirstSeen = useMemo(
    () => present.find((p) => p.user_id === viewerId)?.first_seen_at ?? null,
    [present, viewerId],
  );
  const dwellOk = !!myFirstSeen && Date.now() - new Date(myFirstSeen).getTime() >= 60_000;

  const eligible =
    isEligibleRoom &&
    !dismissed &&
    present.length >= 2 &&
    viewerId !== lastActorId &&
    dwellOk;

  // Seeded delay 10–250s, deterministic per (user, room, 10-min epoch bucket)
  const delayMs = useMemo(() => {
    const bucket = Math.floor(Date.now() / 600_000);
    const r = seededRand(`${viewerId}|${roomId}|${bucket}`);
    return Math.floor(10_000 + r * 240_000);
  }, [viewerId, roomId]);

  useEffect(() => {
    if (!eligible) {
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(t);
  }, [eligible, delayMs]);

  // Auto-dismiss 20s after appearing
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 20_000);
    return () => window.clearTimeout(t);
  }, [open]);

  function dismiss() {
    setOpen(false);
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`host-nudge:${roomId}`, "1");
    }
  }

  async function onClaim() {
    try {
      await claim({ data: { roomId } });
      toast("Claiming host — others have 10s to object.");
      qc.invalidateQueries({ queryKey: ["instant-room", roomId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't claim");
    } finally {
      dismiss();
    }
  }

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 max-w-sm">
      <div className="pointer-events-auto relative rounded-2xl border border-border bg-surface-2/95 p-3 shadow-soft backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl [background:radial-gradient(60%_70%_at_30%_50%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_75%)]"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Have an idea?</p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">
              Become the Host to start working on it.
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClaim}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                Become the Host
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex h-7 items-center rounded-full px-2 text-[11px] text-ink-muted hover:text-ink"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
