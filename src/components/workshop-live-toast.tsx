import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type LiveItem = {
  id: string;
  entityId: string;
  title: string;
  slug: string;
  kind: string;
};

const DEDUPE_KEY = "ws_live_toast_seen_v1";

function readSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEDUPE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function markSeen(entityId: string) {
  try {
    const seen = readSeen();
    seen[entityId] = Date.now();
    // prune entries older than 7d
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(seen)) {
      if (v < cutoff) delete seen[k];
    }
    localStorage.setItem(DEDUPE_KEY, JSON.stringify(seen));
  } catch {}
}

/**
 * Bottom-right "a workshop you RSVP'd to is going live" toast.
 * Subscribes to inserts on `notifications` for the current user, filtered to
 * the workshop-going-live kinds. Renders one card at a time, auto-dismisses
 * after 60s. Deduped by entity_id in localStorage. Suppressed when the user
 * is already viewing that workshop's room.
 */
export function WorkshopLiveToast() {
  const { user } = useAuth();
  const location = useLocation();
  const [item, setItem] = useState<LiveItem | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`ws-live-toast:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            kind: string;
            entity_id: string | null;
            payload: Record<string, unknown> | null;
          };
          if (!row.entity_id) return;
          if (row.kind !== "workshop_starting" && row.kind !== "workshop_now_live") return;
          const slug = (row.payload?.slug as string) || "";
          const title = (row.payload?.title as string) || "A workshop";
          if (!slug) return;
          // Don't fire if we're already viewing that workshop's room.
          if (location.pathname === `/workshops/${slug}`) return;
          // Dedupe by entity_id.
          const seen = readSeen();
          if (seen[row.entity_id]) return;
          markSeen(row.entity_id);
          setItem({ id: row.id, entityId: row.entity_id, title, slug, kind: row.kind });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), 60_000);
    return () => clearTimeout(t);
  }, [item]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="fixed bottom-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-lift md:bottom-6 md:right-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 p-4">
            <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-background">
              <Radio className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-coral opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                {item.kind === "workshop_starting" ? "Starting now" : "Going live"}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">A workshop you RSVP'd to.</p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to="/workshops/$slug"
                  params={{ slug: item.slug }}
                  onClick={() => setItem(null)}
                  className="inline-flex items-center justify-center rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
                >
                  Join now
                </Link>
                <button
                  type="button"
                  onClick={() => setItem(null)}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setItem(null)}
              aria-label="Dismiss"
              className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
