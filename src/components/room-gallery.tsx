import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, Pin, PinOff, ChevronUp, ChevronDown } from "lucide-react";
import { useQueries, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryChip } from "@/components/category-chip";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { pinWork, unpinWork, reorderHostWorkPins } from "@/lib/room-work-pins.functions";
import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type GalleryWork = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  cover_url: string | null;
  created_by: string;
  published_at: string | null;
};

export type GalleryMember = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  speaking?: boolean;
};

type WorkPinRow = {
  id: string;
  work_id: string;
  pinned_by_user_id: string;
  is_host_pin: boolean;
  sort_order: number;
  created_at: string;
};

const PER_USER_LIMIT = 30;

async function fetchUserWorks(userId: string): Promise<GalleryWork[]> {
  const { data } = await supabase
    .from("works")
    .select("id,title,slug,category,cover_url,created_by,published_at")
    .eq("created_by", userId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(PER_USER_LIMIT);
  return (data ?? []) as GalleryWork[];
}

export function RoomGallery({
  members,
  meUserId,
  roomId,
  hostUserId,
  onOpenWork,
  onOpenProfile,
  className,
  fullscreen = false,
}: {
  members: GalleryMember[];
  meUserId: string;
  roomId?: string;
  hostUserId?: string | null;
  onOpenWork: (workId: string) => void;
  onOpenProfile?: (userId: string) => void;
  className?: string;
  fullscreen?: boolean;
}) {
  const [tab, setTab] = useState("everyone");
  const qc = useQueryClient();
  const isHost = !!hostUserId && meUserId === hostUserId;

  const results = useQueries({
    queries: members.map((m) => ({
      queryKey: ["room-gallery-works", m.user_id] as const,
      queryFn: () => fetchUserWorks(m.user_id),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    })),
  });

  const worksByUser = useMemo(() => {
    const map: Record<string, GalleryWork[]> = {};
    members.forEach((m, i) => {
      map[m.user_id] = (results[i]?.data ?? []) as GalleryWork[];
    });
    return map;
  }, [members, results]);

  const loading = results.some((r) => r.isLoading);

  const everyone = useMemo(() => {
    const all: GalleryWork[] = [];
    for (const id of Object.keys(worksByUser)) all.push(...worksByUser[id]);
    return all.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  }, [worksByUser]);

  const worksById = useMemo(() => {
    const m = new Map<string, GalleryWork>();
    everyone.forEach((w) => m.set(w.id, w));
    return m;
  }, [everyone]);

  // Pins
  const pinsKey = ["room-work-pins", roomId ?? ""];
  const { data: pins = [] } = useQuery({
    queryKey: pinsKey,
    queryFn: async (): Promise<WorkPinRow[]> => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("instant_room_work_pins")
        .select("id,work_id,pinned_by_user_id,is_host_pin,sort_order,created_at")
        .eq("room_id", roomId);
      if (error) throw error;
      return data as WorkPinRow[];
    },
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-work-pins:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instant_room_work_pins", filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: pinsKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const pinByWorkId = useMemo(() => {
    const m = new Map<string, WorkPinRow>();
    pins.forEach((p) => m.set(p.work_id, p));
    return m;
  }, [pins]);
  const myGuestPin = useMemo(
    () => pins.find((p) => !p.is_host_pin && p.pinned_by_user_id === meUserId) ?? null,
    [pins, meUserId],
  );

  const orderedPins = useMemo(() => {
    const hostPins = pins.filter((p) => p.is_host_pin).sort((a, b) => a.sort_order - b.sort_order);
    const guestPins = pins.filter((p) => !p.is_host_pin).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return [...hostPins, ...guestPins].filter((p) => worksById.has(p.work_id));
  }, [pins, worksById]);

  const pinFn = useServerFn(pinWork);
  const unpinFn = useServerFn(unpinWork);
  const reorderFn = useServerFn(reorderHostWorkPins);

  const doPin = useMutation({
    mutationFn: (workId: string) => {
      if (!roomId) throw new Error("Room not ready");
      return pinFn({ data: { roomId, workId } });
    },
    onSuccess: () => {
      toast.success("Pinned");
      qc.invalidateQueries({ queryKey: pinsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doUnpin = useMutation({
    mutationFn: (pinId: string) => unpinFn({ data: { pinId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pinsKey }),
    onError: (e: Error) => toast.error(e.message),
  });
  const doReorder = useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (!roomId) throw new Error("Room not ready");
      return reorderFn({ data: { roomId, orderedIds } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pinsKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveHostPin = (workId: string, dir: -1 | 1) => {
    const hostPinIds = orderedPins.filter((p) => p.is_host_pin).map((p) => p.id);
    const pin = pinByWorkId.get(workId);
    if (!pin) return;
    const idx = hostPinIds.indexOf(pin.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= hostPinIds.length) return;
    const next = [...hostPinIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    doReorder.mutate(next);
  };

  const [confirmReplaceFor, setConfirmReplaceFor] = useState<string | null>(null);
  const handlePinClick = (workId: string) => {
    if (!roomId) return;
    if (!isHost && myGuestPin && myGuestPin.work_id !== workId) {
      setConfirmReplaceFor(workId);
      return;
    }
    doPin.mutate(workId);
  };

  const canPin = !!roomId;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-border bg-surface",
        fullscreen ? "h-full rounded-2xl shadow-2xl" : "rounded-2xl",
        className,
      )}
    >
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border px-3 py-2",
            fullscreen && "bg-background/5",
          )}
        >
          <div className="flex-1 overflow-x-auto">
            <TabsList className="bg-transparent gap-1 h-auto p-0 inline-flex">
              {orderedPins.length > 0 && (
                <TabsTrigger
                  value="pinned"
                  className="rounded-full px-3 py-1 text-xs gap-1.5 data-[state=active]:bg-ink data-[state=active]:text-background"
                >
                  <Pin className="h-3 w-3" />
                  Pinned <span className="ml-0.5 text-[10px] opacity-70">{orderedPins.length}</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="everyone"
                className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-ink data-[state=active]:text-background"
              >
                Everyone <span className="ml-1.5 text-[10px] opacity-70">{everyone.length}</span>
              </TabsTrigger>
              {members.map((m) => {
                const count = worksByUser[m.user_id]?.length ?? 0;
                const display = m.display_name || m.username || "Anon";
                const initial = (display[0] || "?").toUpperCase();
                return (
                  <TabsTrigger
                    key={m.user_id}
                    value={m.user_id}
                    className="rounded-full px-2.5 py-1 text-xs gap-1.5 data-[state=active]:bg-ink data-[state=active]:text-background"
                  >
                    <span className="relative inline-flex h-4 w-4 overflow-hidden rounded-full bg-muted">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[8px] text-ink-muted">
                          {initial}
                        </span>
                      )}
                    </span>
                    <span className="max-w-[80px] truncate">{display.split(" ")[0]}</span>
                    {m.speaking && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                    <span className="text-[10px] opacity-70">{count}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto", fullscreen ? "p-4 md:p-5" : "p-3")}>
          {loading && everyone.length === 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {orderedPins.length > 0 && (
                <TabsContent value="pinned" className="m-0">
                  <PinnedGrid
                    pins={orderedPins}
                    worksById={worksById}
                    onOpen={onOpenWork}
                    fullscreen={fullscreen}
                    isHost={isHost}
                    meUserId={meUserId}
                    onUnpin={(pinId) => doUnpin.mutate(pinId)}
                    onMove={(workId, dir) => moveHostPin(workId, dir)}
                  />
                </TabsContent>
              )}
              <TabsContent value="everyone" className="m-0">
                <Grid
                  works={everyone}
                  onOpen={onOpenWork}
                  emptyMember={null}
                  onOpenProfile={onOpenProfile}
                  fullscreen={fullscreen}
                  canPin={canPin}
                  pinByWorkId={pinByWorkId}
                  isHost={isHost}
                  meUserId={meUserId}
                  onPin={handlePinClick}
                  onUnpin={(pinId) => doUnpin.mutate(pinId)}
                />
              </TabsContent>
              {members.map((m) => (
                <TabsContent key={m.user_id} value={m.user_id} className="m-0">
                  <Grid
                    works={worksByUser[m.user_id] ?? []}
                    onOpen={onOpenWork}
                    emptyMember={m}
                    isMe={m.user_id === meUserId}
                    onOpenProfile={onOpenProfile}
                    fullscreen={fullscreen}
                    canPin={canPin}
                    pinByWorkId={pinByWorkId}
                    isHost={isHost}
                    meUserId={meUserId}
                    onPin={handlePinClick}
                    onUnpin={(pinId) => doUnpin.mutate(pinId)}
                  />
                </TabsContent>
              ))}
            </>
          )}
        </div>
      </Tabs>

      <AlertDialog open={!!confirmReplaceFor} onOpenChange={(o) => !o && setConfirmReplaceFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your pin?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only pin one Work in this Workshop. Pinning this one will unpin your current pick.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReplaceFor) doPin.mutate(confirmReplaceFor);
                setConfirmReplaceFor(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PinnedGrid({
  pins,
  worksById,
  onOpen,
  fullscreen,
  isHost,
  meUserId,
  onUnpin,
  onMove,
}: {
  pins: WorkPinRow[];
  worksById: Map<string, GalleryWork>;
  onOpen: (workId: string) => void;
  fullscreen: boolean;
  isHost: boolean;
  meUserId: string;
  onUnpin: (pinId: string) => void;
  onMove: (workId: string, dir: -1 | 1) => void;
}) {
  const hostPinCount = pins.filter((p) => p.is_host_pin).length;
  return (
    <div
      className={cn(
        "grid gap-2",
        fullscreen ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {pins.map((p) => {
        const w = worksById.get(p.work_id)!;
        const canUnpin = isHost || p.pinned_by_user_id === meUserId;
        const hostIdx = p.is_host_pin ? pins.filter((x) => x.is_host_pin).findIndex((x) => x.id === p.id) : -1;
        return (
          <Tile
            key={p.id}
            work={w}
            onOpen={onOpen}
            overlay={
              <>
                {isHost && p.is_host_pin && (
                  <div className="absolute right-1 top-1 flex flex-col gap-0.5">
                    <Button
                      size="icon" variant="secondary"
                      className="h-6 w-6 rounded-full bg-background/80 backdrop-blur"
                      disabled={hostIdx <= 0}
                      onClick={(e) => { e.stopPropagation(); onMove(w.id, -1); }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon" variant="secondary"
                      className="h-6 w-6 rounded-full bg-background/80 backdrop-blur"
                      disabled={hostIdx < 0 || hostIdx >= hostPinCount - 1}
                      onClick={(e) => { e.stopPropagation(); onMove(w.id, 1); }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {canUnpin && (
                  <Button
                    size="icon" variant="secondary"
                    className="absolute left-1 top-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur"
                    onClick={(e) => { e.stopPropagation(); onUnpin(p.id); }}
                    title="Unpin"
                  >
                    <PinOff className="h-3 w-3" />
                  </Button>
                )}
              </>
            }
            badge={p.is_host_pin ? "Host pin" : "Pinned"}
          />
        );
      })}
    </div>
  );
}

function Grid({
  works,
  onOpen,
  emptyMember,
  isMe,
  fullscreen = false,
  canPin = false,
  pinByWorkId,
  isHost = false,
  meUserId,
  onPin,
  onUnpin,
}: {
  works: GalleryWork[];
  onOpen: (workId: string) => void;
  emptyMember: GalleryMember | null;
  isMe?: boolean;
  onOpenProfile?: (userId: string) => void;
  fullscreen?: boolean;
  canPin?: boolean;
  pinByWorkId?: Map<string, WorkPinRow>;
  isHost?: boolean;
  meUserId?: string;
  onPin?: (workId: string) => void;
  onUnpin?: (pinId: string) => void;
}) {
  if (works.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-sm text-ink-muted">
        <ImageOff className="mb-2 h-5 w-5 opacity-50" />
        {emptyMember ? (
          isMe ? (
            <p>
              You haven't published anything yet.
              <br />
              Share a piece — your Workshop can see it here.
            </p>
          ) : (
            <p>
              {emptyMember.display_name || emptyMember.username || "They"} hasn't published anything
              yet.
              <br />
              Ask them about what they're working on.
            </p>
          )
        ) : (
          <p>No Work in this Workshop yet.</p>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid gap-2",
        fullscreen
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      <AnimatePresence initial={false}>
        {works.map((w, i) => {
          const existing = pinByWorkId?.get(w.id);
          const canUnpin = !!existing && (isHost || existing.pinned_by_user_id === meUserId);
          return (
            <Tile
              key={w.id}
              work={w}
              onOpen={onOpen}
              delayIndex={i}
              overlay={canPin && (
                existing ? (
                  canUnpin ? (
                    <Button
                      size="icon" variant="secondary"
                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur"
                      onClick={(e) => { e.stopPropagation(); onUnpin?.(existing.id); }}
                      title="Unpin"
                    >
                      <PinOff className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span className="absolute right-1 top-1 inline-flex h-6 items-center gap-1 rounded-full bg-background/80 px-2 text-[10px] text-ink-muted backdrop-blur">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )
                ) : (
                  <Button
                    size="icon" variant="secondary"
                    className="absolute right-1 top-1 h-6 w-6 rounded-full bg-background/80 opacity-0 backdrop-blur transition group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onPin?.(w.id); }}
                    title="Pin"
                  >
                    <Pin className="h-3 w-3" />
                  </Button>
                )
              )}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Tile({
  work,
  onOpen,
  overlay,
  badge,
  delayIndex = 0,
}: {
  work: GalleryWork;
  onOpen: (workId: string) => void;
  overlay?: React.ReactNode;
  badge?: string;
  delayIndex?: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: Math.min(delayIndex * 0.02, 0.2) }}
      whileHover={{ y: -2 }}
      onClick={() => onOpen(work.id)}
      className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border hover:ring-primary transition"
    >
      {work.cover_url ? (
        <img
          src={work.cover_url}
          alt={work.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full gradient-soft" />
      )}
      <div className="absolute left-1.5 top-1.5">
        <CategoryChip category={work.category} />
      </div>
      {badge && (
        <span className="absolute right-1.5 bottom-9 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
          {badge}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
        <div className="text-[11px] font-medium leading-tight text-white line-clamp-2">
          {work.title}
        </div>
      </div>
      {overlay}
    </motion.button>
  );
}
