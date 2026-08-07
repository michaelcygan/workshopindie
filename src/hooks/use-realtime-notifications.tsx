import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single per-session realtime subscription for the signed-in user's
 * notifications.
 *
 * WHY THIS EXISTS
 * ---------------
 * The header used to open four always-on channels per session:
 *
 *   notifications-bell   notifications INSERT   filter: user_id=eq.<uid>
 *   use-title-badge      notifications *        filter: user_id=eq.<uid>
 *   messages-inbox       messages I/U + convs   filter: NONE
 *   use-title-badge      messages I/U + convs   filter: NONE
 *
 * The first two were exact duplicates. The last two were the real problem:
 * with no server-side filter, the realtime server evaluated *every message
 * insert in the app* against *every connected session*. RLS stops other
 * users from reading those rows, but it does not stop the fan-out work —
 * so the cost was O(connected sessions x messages), i.e. ~20k channel
 * evaluations per DM at 10k concurrent users.
 *
 * `messages` has no recipient column (only conversation_id / sender_id) and
 * `conversations` splits the pair across user_a/user_b, so a postgres_changes
 * equality filter cannot express "rows for me" on either table. Instead the
 * DM badge now rides the `dm` notification kind, which is already written per
 * recipient and already filterable by user_id.
 *
 * Net effect: 4 always-on channels per session -> 1, and the unfiltered
 * app-wide `messages` fan-out is gone.
 */

export type NotificationEvent = {
  id: string;
  kind: string;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type ChangeType = "INSERT" | "UPDATE" | "DELETE";
type Listener = (row: NotificationEvent, change: ChangeType) => void;

type Hub = { subscribe: (fn: Listener) => () => void };

const RealtimeNotificationsContext = createContext<Hub | null>(null);

export function RealtimeNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (!user) return;

    // Per-mount suffix keeps StrictMode's double-invoke from colliding on a
    // topic name while the first channel is still tearing down.
    const uid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`notifications:${user.id}:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as NotificationEvent | undefined;
          if (!row) return;
          const change = payload.eventType as ChangeType;
          // One bad listener must not starve the others.
          for (const fn of listeners.current) {
            try {
              fn(row, change);
            } catch {
              /* noop */
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo<Hub>(
    () => ({
      subscribe(fn) {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
    }),
    [],
  );

  return (
    <RealtimeNotificationsContext.Provider value={value}>
      {children}
    </RealtimeNotificationsContext.Provider>
  );
}

/**
 * Register a callback for the signed-in user's notification changes.
 * The callback is held in a ref, so it may close over fresh state without
 * resubscribing on every render.
 */
export function useNotificationEvents(fn: Listener) {
  const hub = useContext(RealtimeNotificationsContext);
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!hub) return;
    return hub.subscribe((row, change) => ref.current(row, change));
  }, [hub]);
}
