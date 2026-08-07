import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { playNotifySound } from "@/lib/notify-sound";
import { useNotificationEvents } from "@/hooks/use-realtime-notifications";

/**
 * Envelope inbox button — pairs visually with NotificationsBell.
 * Shows the count of conversations with any unread inbound message (capped 9+).
 *
 * Realtime arrives via the shared per-session notifications channel: a new DM
 * writes a `dm` notification row for the recipient, which is already filtered
 * server-side by user_id. This component previously subscribed to the whole
 * `messages` table with no filter, which made every DM in the app fan out to
 * every connected session. See use-realtime-notifications.
 *
 * The signal only tells us "something changed" — the count itself is still a
 * real query, debounced, and also refreshed on tab focus and on `dm:read`.
 */
export function MessagesInboxButton() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [pulse, setPulse] = useState(false);
  const lastUnreadRef = useRef(0);
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    let convIds: string[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadUnread() {
      if (cancelled) return;
      // Re-read the conversation set each time: a brand-new thread must be
      // counted, and we no longer watch `conversations` over realtime.
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (cancelled) return;
      convIds = (convs ?? []).map((c) => c.id);
      if (!convIds.length) {
        setUnread(0);
        lastUnreadRef.current = 0;
        return;
      }
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", user!.id)
        .is("read_at", null);
      if (cancelled) return;
      const next = new Set((msgs ?? []).map((m) => m.conversation_id)).size;
      setUnread(next);
      if (next > lastUnreadRef.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
        playNotifySound();
      }
      lastUnreadRef.current = next;
    }

    function scheduleReload() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadUnread, 250);
    }
    reloadRef.current = scheduleReload;

    loadUnread().catch(() => {
      if (!cancelled) setUnread(0);
    });

    function onFocus() { scheduleReload(); }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dm:read", onFocus);

    return () => {
      cancelled = true;
      reloadRef.current = () => {};
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dm:read", onFocus);
    };
  }, [user?.id]);

  const onNotification = useCallback((row: { kind: string }) => {
    if (row.kind !== "dm") return;
    reloadRef.current();
  }, []);
  useNotificationEvents(onNotification);


  if (!user) return null;

  return (
    <Link
      to="/dms"
      aria-label={unread > 0 ? `Messages (${unread} unread)` : "Messages"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-border hover:bg-muted"
    >
      <Mail className="h-4 w-4" />
      {unread > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-background ${
            pulse ? "animate-in zoom-in-50 duration-200" : ""
          }`}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
