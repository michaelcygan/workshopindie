import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Auto check-in. Called when an RSVP'd viewer opens the event page during
 * the live window. Idempotent — only stamps if not already checked in.
 * Returns { checkedIn: true } when the row was actually flipped, else false.
 * Silent on permission failures so the page never blanks because of this.
 */
export const autoCheckInToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    try {
      // Only flip if currently RSVP'd going/maybe AND not already checked in.
      const { data: existing } = await supabase
        .from("group_event_rsvps")
        .select("status,checked_in_at")
        .eq("event_id", data.event_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return { checkedIn: false, reason: "no_rsvp" as const };
      if (existing.checked_in_at) return { checkedIn: false, reason: "already" as const };
      if (existing.status !== "going" && existing.status !== "maybe") {
        return { checkedIn: false, reason: "not_attending" as const };
      }
      const { error } = await supabase
        .from("group_event_rsvps")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("event_id", data.event_id)
        .eq("user_id", userId);
      if (error) return { checkedIn: false, reason: "error" as const };
      return { checkedIn: true, reason: "ok" as const };
    } catch {
      return { checkedIn: false, reason: "error" as const };
    }
  });

export type CheckedInAttendee = {
  user_id: string;
  checked_in_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/**
 * People who have actually opened the event page during the live window
 * (or post-event, for the "Who was here" recap). Public surface — anyone
 * who can see the event can see who's here.
 */
export const listCheckedInAttendees = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<CheckedInAttendee[]> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_rsvps")
      .select(
        "user_id,checked_in_at,profile:profiles!inner(display_name,username,avatar_url,discoverable)",
      )
      .eq("event_id", data.event_id)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(200);
    if (error) return [];
    type R = {
      user_id: string;
      checked_in_at: string;
      profile: {
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        discoverable: boolean;
      } | null;
    };
    const list = ((rows ?? []) as unknown as R[])
      .filter((r) => r.profile && r.profile.discoverable)
      .map((r) => ({
        user_id: r.user_id,
        checked_in_at: r.checked_in_at,
        display_name: r.profile!.display_name,
        username: r.profile!.username,
        avatar_url: r.profile!.avatar_url,
      }));
    return list;
  });
