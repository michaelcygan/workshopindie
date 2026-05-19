import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Plus, Radio } from "lucide-react";
import { listActiveInstantRooms, type ActiveInstantRoom } from "@/lib/instant.functions";
import { CATEGORIES, type Category } from "@/lib/categories";

type Props = {
  onJoinMedium: (medium: Category) => void;
  onLiveCountChange?: (n: number) => void;
};

export function LoungeForkDropdown({ onJoinMedium, onLiveCountChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fetchRooms = useServerFn(listActiveInstantRooms);

  const { data } = useQuery({
    queryKey: ["instant-active-rooms"],
    queryFn: () => fetchRooms(),
    refetchInterval: 5000,
  });

  const rooms = data?.rooms ?? [];
  const liveCount = rooms.reduce((acc, r) => acc + r.live_count, 0);

  useEffect(() => {
    onLiveCountChange?.(liveCount);
  }, [liveCount, onLiveCountChange]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const mediumRooms = rooms.filter((r): r is ActiveInstantRoom & { medium: Category } => !!r.medium);
  const mediumLiveMap = new Map<Category, number>();
  for (const r of mediumRooms) mediumLiveMap.set(r.medium, (mediumLiveMap.get(r.medium) ?? 0) + r.live_count);

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-baseline gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="font-display text-4xl md:text-6xl text-ink">Workshop</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="inline-flex"
        >
          <ChevronDown className="h-6 w-6 md:h-8 md:w-8 text-ink-muted group-hover:text-ink transition-colors" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute left-0 top-full z-30 mt-3 w-[min(92vw,420px)] origin-top-left rounded-2xl border border-ink/10 bg-background p-3 shadow-xl"
          >
            <div className="px-2 pb-2 pt-1 text-xs uppercase tracking-wide text-ink-muted">Always on</div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-ink">Workshop</span>
              </div>
              <span className="text-xs text-ink-muted">Click "Drop in"</span>
            </div>

            {mediumRooms.length > 0 && (
              <>
                <div className="mt-4 px-2 pb-2 text-xs uppercase tracking-wide text-ink-muted">Live mediums</div>
                <ul className="space-y-1">
                  {mediumRooms.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => { setOpen(false); onJoinMedium(r.medium); }}
                        className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <span className="flex items-center gap-2">
                          <span className="relative inline-flex h-2 w-2">
                            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          <span className="text-sm font-medium text-ink">{r.title}</span>
                        </span>
                        <span className="text-xs text-ink-muted">{r.live_count}/5</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-4 px-2 pb-2 text-xs uppercase tracking-wide text-ink-muted">
              Start a medium-specific Workshop
            </div>
            <div className="flex flex-wrap gap-1.5 px-1 pb-1">
              {CATEGORIES.map((c) => {
                const live = mediumLiveMap.get(c.id) ?? 0;
                const active = live > 0;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    whileHover={{ y: -1, scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setOpen(false); onJoinMedium(c.id); }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border border-primary/40 bg-primary/10 text-ink"
                        : "border border-dashed border-ink/20 text-ink-muted hover:border-ink/40 hover:text-ink",
                    ].join(" ")}
                  >
                    {!active && <Plus className="h-3 w-3" />}
                    {c.label}
                    {active && <span className="text-ink-muted">· {live}</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
