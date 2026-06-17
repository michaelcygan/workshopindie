import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { rsvp } from "@/lib/group-events.functions";
import { toast } from "sonner";

const KEY = "workshop:pending_rsvp";

export type PendingRsvp = {
  event_id: string;
  status: "going" | "maybe" | "declined";
  redirect_to: string;
};

export function setPendingRsvp(p: PendingRsvp) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function consumePendingRsvp(): PendingRsvp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PendingRsvp;
  } catch {
    return null;
  }
}

/** Flushes a pending RSVP after the user signs in. Mount once near the root. */
export function usePendingRsvpFlush() {
  const { user } = useAuth();
  const rsvpFn = useServerFn(rsvp);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const p = consumePendingRsvp();
    if (!p) return;
    rsvpFn({ data: { event_id: p.event_id, status: p.status } })
      .then(() => {
        toast.success("You're in!");
        navigate({ to: p.redirect_to });
      })
      .catch((e: Error) => toast.error(e.message));
  }, [user, rsvpFn, navigate]);
}
