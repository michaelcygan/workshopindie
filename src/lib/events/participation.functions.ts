/**
 * Participation: explicit check-in and the "Who's here" roster.
 *
 * Check-in is never automatic — a person taps to say they're in the room.
 * The roster is not public: only confirmed participants, hosts and admins
 * can see who is here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventInput = z.object({ event_id: z.string().uuid() });

export type CheckInResult = {
  checkedIn: boolean;
  reason: "ok" | "already" | "not_attending" | "closed";
};

export const checkInToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventInput.parse(i))
  .handler(async ({ data, context }): Promise<CheckInResult> => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);
    if (access.isCheckedIn) return { checkedIn: true, reason: "already" };
    if (!access.isAttending) return { checkedIn: false, reason: "not_attending" };
    if (!access.canCheckIn) return { checkedIn: false, reason: "closed" };
    const { error } = await supabase
      .from("group_event_rsvps")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("event_id", data.event_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { checkedIn: true, reason: "ok" };
  });

export const undoCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_event_rsvps")
      .update({ checked_in_at: null })
      .eq("event_id", data.event_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type RosterPerson = {
  user_id: string;
  checked_in_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/** Who's here — checked-in people, visible to participants only. */
export const listEventRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventInput.parse(i))
  .handler(async ({ data, context }): Promise<RosterPerson[]> => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);
    if (!access.canSeeRoster) return [];
    const { data: rows, error } = await supabase
      .from("group_event_rsvps")
      .select("user_id,checked_in_at,profile:profiles!inner(display_name,username,avatar_url)")
      .eq("event_id", data.event_id)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(300);
    if (error) return [];
    type R = {
      user_id: string;
      checked_in_at: string;
      profile: {
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    };
    return ((rows ?? []) as unknown as R[]).map((r) => ({
      user_id: r.user_id,
      checked_in_at: r.checked_in_at,
      display_name: r.profile?.display_name ?? null,
      username: r.profile?.username ?? null,
      avatar_url: r.profile?.avatar_url ?? null,
    }));
  });

/** Counts for the flyer: how many are going, how many are in the room. */
export const getEventCounts = createServerFn({ method: "POST" })
  .inputValidator((i) => eventInput.parse(i))
  .handler(async ({ data }): Promise<{ going: number; here: number }> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const [going, here] = await Promise.all([
      supabase
        .from("group_event_rsvps")
        .select("user_id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .in("status", ["going", "maybe"]),
      supabase
        .from("group_event_rsvps")
        .select("user_id", { count: "exact", head: true })
        .eq("event_id", data.event_id)
        .not("checked_in_at", "is", null),
    ]);
    return { going: going.count ?? 0, here: here.count ?? 0 };
  });
