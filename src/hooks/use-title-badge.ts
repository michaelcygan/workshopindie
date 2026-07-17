import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prefix the browser tab title with `(n) ` when the tab is hidden and the
 * signed-in user has unread notifications or DMs. Restores the original
 * title on focus and on unmount.
 *
 * Mounted once from `src/routes/__root.tsx`. The bell/envelope components
 * still own their own visible badges + sounds; this hook just mirrors the
 * total unread into the tab title so users notice from another tab.
 */
export function useTitleBadge() {
  const { user } = useAuth();
  const [notifUnread, setNotifUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "");

  // Track base title (the title set by route head())
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Strip any existing "(n) " prefix from a prior badge before capturing.
    baseTitleRef.current = document.title.replace(/^\(\d+\)\s+/, "");
  }, []);

  // Load + subscribe to notifications unread count.
  useEffect(() => {
    if (!user) { setNotifUnread(0); return; }
    let cancelled = false;

    async function load() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (!cancelled) setNotifUnread(count ?? 0);
    }
    load();

    const uid = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const ch = supabase
      .channel(`title-notifs:${user.id}:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id]);

  // Load + subscribe to DM unread count.
  useEffect(() => {
    if (!user) { setDmUnread(0); return; }
    let cancelled = false;
    let convIds: string[] = [];
    let debounce: ReturnType<typeof setTimeout> | null = null;

    async function loadUnread() {
      if (!convIds.length) { if (!cancelled) setDmUnread(0); return; }
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", user!.id)
        .is("read_at", null);
      if (cancelled) return;
      setDmUnread(new Set((data ?? []).map((m) => m.conversation_id)).size);
    }
    function schedule() { if (debounce) clearTimeout(debounce); debounce = setTimeout(loadUnread, 250); }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (cancelled) return;
      convIds = (convs ?? []).map((c) => c.id);
      await loadUnread();
      if (!convIds.length) return;
      const uid = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      channel = supabase
        .channel(`title-dm:${user!.id}:${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
          const m = p.new as { conversation_id: string };
          if (convIds.includes(m.conversation_id)) schedule();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => {
          const m = p.new as { conversation_id: string };
          if (convIds.includes(m.conversation_id)) schedule();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (p) => {
          const c = p.new as { id: string; user_a: string; user_b: string };
          if (c.user_a === user!.id || c.user_b === user!.id) { convIds = [...convIds, c.id]; schedule(); }
        })
        .subscribe();
    })().catch(() => { if (!cancelled) setDmUnread(0); });

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Reflect total unread into tab title while the tab is hidden.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = notifUnread + dmUnread;

    function apply() {
      const base = baseTitleRef.current || document.title.replace(/^\(\d+\)\s+/, "");
      if (!base) return;
      if (document.hidden && total > 0) {
        const badge = total > 99 ? "99+" : String(total);
        document.title = `(${badge}) ${base}`;
      } else {
        document.title = base;
      }
    }
    apply();

    function onVis() { apply(); }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      // Restore on unmount.
      const base = baseTitleRef.current;
      if (base) document.title = base;
    };
  }, [notifUnread, dmUnread]);
}
