import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkPeek } from "@/components/work-peek";

type Member = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type WorkRow = {
  id: string;
  title: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
};

/**
 * Live "in this Workshop" rail — surfaces public works of the people currently
 * in the room so conversation has portfolio context to latch onto.
 *
 * - Pulls up to 2 most-recent public published works per presence user.
 * - When the viewer is alone, falls back to their own recent works so the
 *   column never feels empty.
 * - Auto-scrolls every 6s when there are more items than fit; pauses on hover.
 */
export function WorkshopPresenceWorksRail({
  members,
  meUserId,
  className = "",
}: {
  members: Member[];
  meUserId: string | null;
  className?: string;
}) {
  const userIds = useMemo(() => members.map((m) => m.user_id).filter(Boolean), [members]);
  const aloneFallbackIds = useMemo(
    () => (userIds.length <= 1 && meUserId ? [meUserId] : userIds),
    [userIds, meUserId],
  );

  const { data: works = [] } = useQuery({
    queryKey: ["ws-presence-works", [...aloneFallbackIds].sort().join(",")],
    enabled: aloneFallbackIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id,title,cover_url,created_by,created_at")
        .in("created_by", aloneFallbackIds)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) return [] as WorkRow[];
      // Keep at most 2 per creator, then cap at 8.
      const perCreator = new Map<string, number>();
      const out: WorkRow[] = [];
      for (const w of (data as WorkRow[]) ?? []) {
        const n = perCreator.get(w.created_by) ?? 0;
        if (n >= 2) continue;
        perCreator.set(w.created_by, n + 1);
        out.push(w);
        if (out.length >= 8) break;
      }
      return out;
    },
  });

  const memberLookup = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  const [peekWorkId, setPeekWorkId] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Soft auto-scroll inside the rail.
  useEffect(() => {
    if (paused || works.length <= 3) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = window.setInterval(() => {
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 4) return;
      const next = el.scrollTop + 64;
      if (next >= max - 4) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollTo({ top: next, behavior: "smooth" });
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, [paused, works.length]);

  const isSelfFallback = userIds.length <= 1;

  return (
    <div
      className={
        "rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-sm overflow-hidden " +
        className
      }
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            {isSelfFallback ? "Your recent work" : "In this Lounge"}
          </p>
          {!isSelfFallback && (
            <p className="text-[10px] text-ink-muted/70">What people here are bringing</p>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="max-h-[280px] overflow-y-auto px-2 pb-2 space-y-1.5 scrollbar-thin"
      >
        {works.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-3 text-[11px] text-ink-muted/70">
            <Sparkles className="h-3 w-3 shrink-0" />
            Works people are bringing will appear here.
          </div>
        ) : (
          works.map((w) => {
            const member = memberLookup.get(w.created_by);
            const name =
              member?.display_name ||
              member?.username ||
              (w.created_by === meUserId ? "You" : "Anon");
            return (
              <motion.button
                key={w.id}
                type="button"
                onClick={() => {
                  setPeekWorkId(w.id);
                  setPeekOpen(true);
                }}
                whileHover={{ y: -1 }}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-background/40 px-2 py-2 text-left transition hover:border-border hover:bg-surface hover:shadow-soft"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {w.cover_url ? (
                    <img
                      src={w.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-muted/60">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ink leading-tight">
                    {w.title || "Untitled"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
                    <span className="inline-flex h-3.5 w-3.5 overflow-hidden rounded-full bg-muted">
                      {member?.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="truncate">{name}</span>
                  </p>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <WorkPeek workId={peekWorkId} open={peekOpen} onOpenChange={setPeekOpen} />
    </div>
  );
}
