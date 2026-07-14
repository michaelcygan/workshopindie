import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Shared like/favorite toggle for a Work. The heart is the single
 * favorite signal — reused by <WorkActions> (full page) and <WorkPeek>
 * (Lounge popover). Handles optimistic updates, auth-gate replay after
 * sign-in, and reconciliation from the toggle_work_reaction RPC.
 */
export function useWorkLike(workId: string | null, initialLikes: number) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [pending, setPending] = useState(false);
  const pendingAfterAuthRef = useRef(false);

  // Sync initial count when workId changes (peek reused for many works).
  useEffect(() => {
    setLikes(initialLikes);
  }, [workId, initialLikes]);

  // Load whether the current user already liked this work.
  useEffect(() => {
    if (!user || !workId) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("work_reactions")
      .select("reaction")
      .eq("user_id", user.id)
      .eq("work_id", workId)
      .eq("reaction", "like")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLiked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, workId]);

  async function doToggle() {
    if (!user || !workId || pending) return;
    setPending(true);
    const wasLiked = liked;
    setLiked((v) => !v);
    setLikes((n) => n + (wasLiked ? -1 : 1));
    const { data, error } = await supabase.rpc("toggle_work_reaction", {
      _work_id: workId,
      _reaction: "like",
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      setLiked(wasLiked);
      setLikes((n) => n + (wasLiked ? 1 : -1));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setLikes(row.like_count);
      setLiked(row.liked);
    }
    // Refresh the private Favorites tab if it's mounted.
    qc.invalidateQueries({ queryKey: ["gallery", "favorites"] });
  }

  // Replay after sign-in via a modal gate.
  useEffect(() => {
    if (!user || !pendingAfterAuthRef.current) return;
    pendingAfterAuthRef.current = false;
    void doToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    liked,
    likes,
    pending,
    isAuthed: !!user,
    toggle: doToggle,
    queueForAfterAuth: () => {
      pendingAfterAuthRef.current = true;
    },
    clearQueued: () => {
      pendingAfterAuthRef.current = false;
    },
  };
}
