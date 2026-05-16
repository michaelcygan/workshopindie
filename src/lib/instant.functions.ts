import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MEDIUMS = ["film", "music", "writing", "build", "visual"] as const;
const mediumSchema = z.enum(MEDIUMS);

/**
 * Matchmaker: drop the user into the fullest active Lounge that still has
 * room (cap 5), or spin up a brand-new Lounge if none has space.
 */
export const joinLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("join_lounge", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { roomId: data as string };
  });

/** Matchmaker for medium-specific Instant Workshops (Film, Music, Writing, Build, Visual). */
export const joinMediumLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { medium: (typeof MEDIUMS)[number] }) =>
    z.object({ medium: mediumSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roomId, error } = await supabaseAdmin.rpc("join_medium_lounge", {
      _user_id: userId,
      _medium: data.medium,
    });
    if (error) throw new Error(error.message);
    return { roomId: roomId as string, medium: data.medium };
  });

export type ActiveInstantRoom = {
  id: string;
  medium: (typeof MEDIUMS)[number] | null;
  title: string;
  live_count: number;
  created_at: string;
};

/** Public list of currently-active Instant rooms (lounges + medium-specific) with live counts. */
export const listActiveInstantRooms = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.rpc("list_active_instant_rooms");
  if (error) throw new Error(error.message);
  return { rooms: (data ?? []) as ActiveInstantRoom[] };
});

export type InstantActivityEvent = {
  id: string;
  kind: "join" | "spawn" | "end";
  medium: (typeof MEDIUMS)[number] | null;
  title: string;
  actor_display_name: string | null;
  created_at: string;
};

/** Public recent activity feed for the ticker. */
export const listRecentActivity = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("instant_activity")
      .select("id, kind, medium, title, actor_display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { events: (rows ?? []) as InstantActivityEvent[] };
  });
