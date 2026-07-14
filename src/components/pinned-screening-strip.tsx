import { useEffect, useId, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Square, PinOff, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { unpinWork } from "@/lib/room-work-pins.functions";
import { startScreening, stopScreening } from "@/lib/room-screening.functions";
import type { ScreeningWork } from "@/components/screening-stage";
import { cn } from "@/lib/utils";

type PinRow = {
  id: string;
  work_id: string;
  pinned_by_user_id: string;
  is_host_pin: boolean;
  sort_order: number;
  created_at: string;
};

type WorkRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  embed_url: string | null;
  status: string;
  created_by: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

/**
 * Lightweight hook: room pins + the referenced Work rows + realtime.
 * Exposes the currently-screening Work (if any) in the shape
 * <ScreeningStage /> expects.
 */
export function useRoomPinsAndScreening(roomId: string | undefined, screeningWorkId: string | null) {
  const qc = useQueryClient();
  const instanceId = useId();
  const pinsKey = ["room-work-pins", roomId ?? ""];

  const { data: pins = [] } = useQuery({
    queryKey: pinsKey,
    queryFn: async (): Promise<PinRow[]> => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("instant_room_work_pins")
        .select("id,work_id,pinned_by_user_id,is_host_pin,sort_order,created_at")
        .eq("room_id", roomId);
      if (error) throw error;
      return data as PinRow[];
    },
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`room-work-pins-strip:${roomId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instant_room_work_pins", filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: pinsKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const workIds = useMemo(() => {
    const ids = new Set(pins.map((p) => p.work_id));
    if (screeningWorkId) ids.add(screeningWorkId);
    return Array.from(ids);
  }, [pins, screeningWorkId]);

  const { data: works = [] } = useQuery({
    queryKey: ["room-pin-works", roomId ?? "", workIds.slice().sort().join(",")],
    enabled: workIds.length > 0,
    queryFn: async (): Promise<WorkRow[]> => {
      const { data, error } = await supabase
        .from("works")
        .select("id,title,slug,cover_url,embed_url,status,created_by")
        .in("id", workIds);
      if (error) throw error;
      return data as WorkRow[];
    },
  });

  const creatorIds = useMemo(() => Array.from(new Set(works.map((w) => w.created_by))), [works]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["room-pin-profiles", creatorIds.slice().sort().join(",")],
    enabled: creatorIds.length > 0,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", creatorIds);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const worksById = useMemo(() => {
    const m = new Map<string, WorkRow>();
    works.forEach((w) => m.set(w.id, w));
    return m;
  }, [works]);
  const profilesById = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const orderedPins = useMemo(() => {
    const hostPins = pins.filter((p) => p.is_host_pin).sort((a, b) => a.sort_order - b.sort_order);
    const guestPins = pins.filter((p) => !p.is_host_pin).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return [...hostPins, ...guestPins].filter((p) => worksById.has(p.work_id));
  }, [pins, worksById]);

  const screeningWork: ScreeningWork | null = useMemo(() => {
    if (!screeningWorkId) return null;
    const w = worksById.get(screeningWorkId);
    if (!w) return null;
    const p = profilesById.get(w.created_by);
    return {
      id: w.id,
      title: w.title,
      slug: w.slug,
      embed_url: w.embed_url,
      creator_display: p?.display_name ?? null,
      creator_username: p?.username ?? null,
    };
  }, [screeningWorkId, worksById, profilesById]);

  return { pins: orderedPins, worksById, profilesById, screeningWork };
}

export function PinnedScreeningStrip({
  roomId,
  meUserId,
  hostUserId,
  screeningWorkId,
  onOpen,
}: {
  roomId: string;
  meUserId: string;
  hostUserId: string | null;
  screeningWorkId: string | null;
  onOpen?: (workId: string) => void;
}) {
  const qc = useQueryClient();
  const { pins, worksById, profilesById } = useRoomPinsAndScreening(roomId, screeningWorkId);
  const startFn = useServerFn(startScreening);
  const stopFn = useServerFn(stopScreening);
  const unpinFn = useServerFn(unpinWork);
  const isHost = !!hostUserId && meUserId === hostUserId;

  const start = useMutation({
    mutationFn: (workId: string) => startFn({ data: { roomId, workId } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const stop = useMutation({
    mutationFn: () => stopFn({ data: { roomId } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const unpin = useMutation({
    mutationFn: (pinId: string) => unpinFn({ data: { pinId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room-work-pins", roomId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (pins.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-background/50 pr-1">
        Pinned
      </span>
      {pins.map((p) => {
        const w = worksById.get(p.work_id)!;
        const creator = profilesById.get(w.created_by);
        const isScreening = screeningWorkId === w.id;
        const canScreen = !!w.embed_url;
        const canUnpin = isHost || p.pinned_by_user_id === meUserId;
        return (
          <div
            key={p.id}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-xl border bg-background/5 px-2 py-1.5 pr-2 transition",
              isScreening
                ? "border-primary/60 shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]"
                : "border-background/10 hover:bg-background/10",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen?.(w.id)}
              className="flex items-center gap-2 text-left"
              title={w.title}
            >
              <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-background/10">
                {w.cover_url ? (
                  <img src={w.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-background/40">
                    <ImageOff className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="max-w-[140px] truncate text-[11px] font-medium text-background">
                  {w.title}
                </div>
                <div className="max-w-[140px] truncate text-[10px] text-background/50">
                  {creator?.display_name || (creator?.username ? `@${creator.username}` : "")}
                </div>
              </div>
            </button>
            {isScreening ? (
              <button
                type="button"
                onClick={() => stop.mutate()}
                disabled={stop.isPending}
                className="inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                title="Stop screening"
              >
                <Square className="h-3 w-3 fill-current" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => canScreen && start.mutate(w.id)}
                disabled={!canScreen || start.isPending}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition",
                  canScreen
                    ? "bg-background/15 text-background hover:bg-background/25"
                    : "bg-background/5 text-background/40 cursor-not-allowed",
                )}
                title={canScreen ? "Screen this Work for the Lounge" : "Not screenable — no playable embed"}
              >
                <Play className="h-3 w-3 fill-current" /> Watch
              </button>
            )}
            {canUnpin && (
              <button
                type="button"
                onClick={() => unpin.mutate(p.id)}
                className="opacity-0 group-hover:opacity-100 rounded-full bg-background/10 p-1 text-background/70 hover:bg-background/20 transition"
                title="Unpin from Lounge"
                aria-label="Unpin"
              >
                <PinOff className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
