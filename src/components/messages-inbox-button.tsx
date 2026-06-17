import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Envelope inbox button — pairs visually with NotificationsBell.
 * Shows unread-conversation count (capped 9+) and updates in realtime.
 */
export function MessagesInboxButton() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  async function loadUnread(uid: string) {
    // Conversations I'm in
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);
    const ids = (convs ?? []).map((c) => c.id);
    if (!ids.length) { setUnread(0); return; }
    // Count of distinct conversations that have any unread inbound msg
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .neq("sender_id", uid)
      .is("read_at", null);
    const distinct = new Set((msgs ?? []).map((m) => m.conversation_id));
    setUnread(distinct.size);
  }

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let cancelled = false;
    loadUnread(user.id).catch(() => { if (!cancelled) setUnread(0); });

    const channel = supabase
      .channel(`dm-inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => { if (!cancelled) loadUnread(user.id).catch(() => {}); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => { if (!cancelled) loadUnread(user.id).catch(() => {}); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
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
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-background animate-in fade-in duration-150">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
