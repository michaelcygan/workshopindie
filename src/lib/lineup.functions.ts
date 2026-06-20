import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isHostOrAdmin(
  supabase: ReturnType<typeof publicClient>,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return true;
  const { data: ev } = await supabase
    .from("group_events")
    .select("created_by,groups:groups!inner(created_by)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return false;
  const e = ev as { created_by: string | null; groups: { created_by: string | null } | null };
  return e.created_by === userId || e.groups?.created_by === userId;
}

// ---- Reads ----

export const getLineupForEvent = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: ev, error: evErr } = await supabase
      .from("group_events")
      .select("id,starts_at,lineup_capacity")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("Event not found");

    const { data: signups, error } = await supabase
      .from("event_lineup_signups")
      .select("id,event_id,user_id,position,status,note,created_at")
      .eq("event_id", data.event_id)
      .neq("status", "released")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((signups ?? []).map((s) => s.user_id).filter(Boolean) as string[]));
    const profiles: Record<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds);
      for (const p of (profs ?? []) as Array<typeof profiles[string]>) profiles[p.id] = p;
    }
    return { event: ev, signups: signups ?? [], profiles };
  });

// ---- Mutations ----

export const signUpForLineup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      note: z.string().trim().max(80).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev } = await supabase
      .from("group_events")
      .select("id,starts_at,ends_at,lineup_capacity")
      .eq("id", data.event_id)
      .maybeSingle();
    if (!ev) throw new Error("Event not found");
    const e = ev as { starts_at: string; ends_at: string; lineup_capacity: number | null };
    if (e.lineup_capacity == null) throw new Error("This event isn't taking lineup signups.");
    if (new Date(e.ends_at).getTime() < Date.now()) throw new Error("This event is over.");

    const { data: existing } = await supabase
      .from("event_lineup_signups")
      .select("id,status")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .neq("status", "released")
      .maybeSingle();
    if (existing) throw new Error("You're already on this lineup.");

    const { error } = await supabase
      .from("event_lineup_signups")
      .insert({
        event_id: data.event_id,
        user_id: userId,
        note: data.note?.trim() || null,
        // position + status are set by trigger
        position: 0,
      } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyLineupNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      note: z.string().trim().max(80).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("event_lineup_signups")
      .update({ note: data.note?.trim() || null })
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .neq("status", "released");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseMyLineupSpot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Delete (cleaner than soft-release; trigger promotes next waitlister).
    const { error } = await supabase
      .from("event_lineup_signups")
      .delete()
      .eq("event_id", data.event_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const hostRemoveFromLineup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ event_id: z.string().uuid(), signup_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isHostOrAdmin(supabase as never, userId, data.event_id))) {
      throw new Error("Only the host or an admin can remove performers.");
    }
    const admin = await getAdmin();
    const { error } = await admin
      .from("event_lineup_signups")
      .delete()
      .eq("id", data.signup_id)
      .eq("event_id", data.event_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
