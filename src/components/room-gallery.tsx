import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, Maximize2 } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryChip } from "@/components/category-chip";
import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

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
  onOpenWork,
  onOpenProfile,
  onEnterFullscreen,
  className,
}: {
  members: GalleryMember[];
  meUserId: string;
  onOpenWork: (workId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onEnterFullscreen?: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState("everyone");

  // Per-user queries — independently cached so prolific creators don't starve.
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
    members.forEach((m, i) => { map[m.user_id] = (results[i]?.data ?? []) as GalleryWork[]; });
    return map;
  }, [members, results]);

  const loading = results.some((r) => r.isLoading);

  const everyone = useMemo(() => {
    const all: GalleryWork[] = [];
    for (const id of Object.keys(worksByUser)) all.push(...worksByUser[id]);
    return all.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  }, [worksByUser]);

  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-surface overflow-hidden", className)}>
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex-1 overflow-x-auto">
            <TabsList className="bg-transparent gap-1 h-auto p-0 inline-flex">
              <TabsTrigger value="everyone" className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-ink data-[state=active]:text-background">
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
                      <span className="flex h-full w-full items-center justify-center text-[8px] text-ink-muted">{initial}</span>
                    )}
                  </span>
                  <span className="max-w-[80px] truncate">{display.split(" ")[0]}</span>
                  {m.speaking && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                  <span className="text-[10px] opacity-70">{count}</span>
                </TabsTrigger>
              );
            })}
            </TabsList>
          </div>
          {onEnterFullscreen && (
            <button
              type="button"
              onClick={onEnterFullscreen}
              className="rounded-full p-1.5 text-ink-muted hover:bg-muted hover:text-ink"
              aria-label="Enter fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && everyone.length === 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="everyone" className="m-0">
                <Grid works={everyone} onOpen={onOpenWork} emptyMember={null} onOpenProfile={onOpenProfile} />
              </TabsContent>
              {members.map((m) => (
                <TabsContent key={m.user_id} value={m.user_id} className="m-0">
                  <Grid
                    works={worksByUser[m.user_id] ?? []}
                    onOpen={onOpenWork}
                    emptyMember={m}
                    isMe={m.user_id === meUserId}
                    onOpenProfile={onOpenProfile}
                  />
                </TabsContent>
              ))}
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function Grid({
  works,
  onOpen,
  emptyMember,
  isMe,
}: {
  works: GalleryWork[];
  onOpen: (workId: string) => void;
  emptyMember: GalleryMember | null;
  isMe?: boolean;
  onOpenProfile?: (userId: string) => void;
}) {
  if (works.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-sm text-ink-muted">
        <ImageOff className="mb-2 h-5 w-5 opacity-50" />
        {emptyMember ? (
          isMe ? (
            <p>You haven't published anything yet.<br />Share a piece — your room can see it here.</p>
          ) : (
            <p>
              {emptyMember.display_name || emptyMember.username || "They"} hasn't published anything yet.
              <br />Ask them about what they're working on.
            </p>
          )
        ) : (
          <p>No works in this room yet.</p>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <AnimatePresence initial={false}>
        {works.map((w, i) => (
          <motion.button
            key={w.id}
            type="button"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
            whileHover={{ y: -2 }}
            onClick={() => onOpen(w.id)}
            className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border hover:ring-primary transition"
          >
            {w.cover_url ? (
              <img src={w.cover_url} alt={w.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
            ) : (
              <div className="h-full w-full gradient-soft" />
            )}
            <div className="absolute left-1.5 top-1.5">
              <CategoryChip category={w.category} />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
              <div className="text-[11px] font-medium leading-tight text-white line-clamp-2">{w.title}</div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
