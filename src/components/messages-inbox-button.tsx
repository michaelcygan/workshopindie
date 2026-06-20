import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Envelope inbox button — pairs visually with NotificationsBell.
 * Shows the count of conversations with any unread inbound message (capped 9+).
 *
 * Realtime is scoped to the viewer's own conversation IDs to avoid a global
 * fanout subscription that would refire on every message in the system.
 * Reloads are debounced and the count refreshes on tab focus.
 */
export function MessagesInboxButton() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [pulse, setPulse] = useState(false);
  const lastUnreadRef = useRef(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    let convIds: string[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadUnread() {
      if (cancelled || !convIds.length) {
        if (!cancelled) setUnread(0);
        return;
      }
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", user!.id)
        .is("read_at", null);
      if (cancelled) return;
      const distinct = new Set((msgs ?? []).map((m) => m.conversation_id));
      const next = distinct.size;
      setUnread(next);
      if (next > lastUnreadRef.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
      lastUnreadRef.current = next;
    }

    function scheduleReload() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadUnread, 250);
    }

    async function bootstrap() {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (cancelled) return;
      convIds = (convs ?? []).map((c) => c.id);
      await loadUnread();

      // Scope realtime to *our* conversations only. We listen for any
      // INSERT/UPDATE on messages and filter client-side via the `in` set —
      // postgres_changes doesn't accept an `in (...)` server filter, so the
      // narrow channel keeps the event volume manageable + debounced.
      if (!convIds.length) return;
      channel = supabase
        .channel(`dm-inbox:${user!.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as { conversation_id: string };
            if (convIds.includes(m.conversation_id)) scheduleReload();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as { conversation_id: string };
            if (convIds.includes(m.conversation_id)) scheduleReload();
          },
        )
        // Pick up freshly-created conversations so the badge stays accurate.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "conversations" },
          (payload) => {
            const c = payload.new as { id: string; user_a: string; user_b: string };
            if (c.user_a === user!.id || c.user_b === user!.id) {
              convIds = [...convIds, c.id];
              scheduleReload();
            }
          },
        )
        .subscribe();
    }

    bootstrap().catch(() => { if (!cancelled) setUnread(0); });

    function onFocus() { scheduleReload(); }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

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
          className={`absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-background ${
            pulse ? "animate-in zoom-in-50 duration-200" : ""
          }`}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
