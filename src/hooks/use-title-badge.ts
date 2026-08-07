import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationEvents } from "@/hooks/use-realtime-notifications";

/**
 * Prefix the browser tab title with `(n) ` when the tab is hidden and the
 * signed-in user has unread notifications or DMs. Restores the original
 * title on focus and on unmount.
 *
 * Mounted once from `src/routes/__root.tsx`. The bell/envelope components
 * still own their own visible badges + sounds; this hook just mirrors the
 * total unread into the tab title so users notice from another tab.
 *
 * Both counts are driven by the shared per-session notifications channel
 * (see use-realtime-notifications). This hook used to open two more channels
 * of its own — one an exact duplicate of the bell's, one an unfiltered
 * subscription to the whole `messages` table.
 */
export function useTitleBadge() {
  const { user } = useAuth();
  const [notifUnread, setNotifUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "");
  const reloadNotifRef = useRef<() => void>(() => {});
  const reloadDmRef = useRef<() => void>(() => {});

  // Track base title (the title set by route head())
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Strip any existing "(n) " prefix from a prior badge before capturing.
    baseTitleRef.current = document.title.replace(/^\(\d+\)\s+/, "");
  }, []);

  // Notifications unread count.
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
    reloadNotifRef.current = () => { void load(); };
    load();

    return () => { cancelled = true; reloadNotifRef.current = () => {}; };
  }, [user?.id]);

  // DM unread count.
  useEffect(() => {
    if (!user) { setDmUnread(0); return; }
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    async function loadUnread() {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      if (cancelled) return;
      const convIds = (convs ?? []).map((c) => c.id);
      if (!convIds.length) { setDmUnread(0); return; }
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", user!.id)
        .is("read_at", null);
      if (cancelled) return;
      setDmUnread(new Set((data ?? []).map((m) => m.conversation_id)).size);
    }
    function schedule() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { void loadUnread(); }, 250);
    }
    reloadDmRef.current = schedule;

    loadUnread().catch(() => { if (!cancelled) setDmUnread(0); });

    // Local reads and cross-tab focus keep the count honest without a
    // realtime subscription on `messages`.
    function onFocus() { schedule(); }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dm:read", onFocus);

    return () => {
      cancelled = true;
      reloadDmRef.current = () => {};
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dm:read", onFocus);
    };
  }, [user?.id]);

  const onNotification = useCallback((row: { kind: string }) => {
    reloadNotifRef.current();
    if (row.kind === "dm") reloadDmRef.current();
  }, []);
  useNotificationEvents(onNotification);


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
