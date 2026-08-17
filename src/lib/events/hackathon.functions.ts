import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HACKATHON_MAX_TEAMS,
  HACKATHON_MIN_TEAMS,
  hackathonSetupProblems,
  isHttpUrl,
  type HackathonMyTeam,
  type HackathonPublicConfig,
} from "@/lib/events/hackathon";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Public shape of a Hackathon: team names, sizes and the full-group time.
 * Room links are structurally absent — the browser has no read grant on that
 * column, and this function never selects it.
 */
export const getHackathonConfig = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<HackathonPublicConfig | null> => {
    const supabase = publicClient();
    const { data: cfg } = await supabase
      .from("event_hackathons")
      .select("event_id,full_group_meeting_at")
      .eq("event_id", data.event_id)
      .maybeSingle();
    if (!cfg) return null;

    const { data: teams } = await supabase
      .from("event_hackathon_teams")
      .select("id,position,name")
      .eq("event_id", data.event_id)
      .order("position", { ascending: true });

    const rows = teams ?? [];
    const counts = await teamCounts(data.event_id);
    return {
      event_id: cfg.event_id,
      full_group_meeting_at: cfg.full_group_meeting_at,
      team_count: rows.length,
      teams: rows.map((t) => ({
        id: t.id,
        position: t.position,
        name: t.name,
        member_count: counts.get(t.id) ?? 0,
      })),
    };
  });

/** Assignment counts are privileged reads; roll them up server-side. */
async function teamCounts(eventId: string): Promise<Map<string, number>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("event_hackathon_assignments")
    .select("team_id")
    .eq("event_id", eventId);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(row.team_id, (map.get(row.team_id) ?? 0) + 1);
  return map;
}

/**
 * The signed-in participant's own team, including the room link. A viewer who
 * is not assigned gets `null` — never a partial object with the link stripped.
 */
export const getMyHackathonTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<HackathonMyTeam | null> => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);
    if (!access.canSeeEvent) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mine } = await supabaseAdmin
      .from("event_hackathon_assignments")
      .select("team_id")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mine) return null;

    const { data: team } = await supabaseAdmin
      .from("event_hackathon_teams")
      .select("id,position,name,meeting_url")
      .eq("id", mine.team_id)
      .maybeSingle();
    if (!team) return null;

    const { data: roster } = await supabaseAdmin
      .from("event_hackathon_assignments")
      .select("user_id")
      .eq("team_id", team.id);
    const ids = (roster ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,username,display_name").in("id", ids)
      : { data: [] as { id: string; username: string | null; display_name: string | null }[] };

    return {
      team_id: team.id,
      position: team.position,
      name: team.name,
      // The link only unlocks once the Event is actually live for this viewer.
      meeting_url: access.isAttending ? (team.meeting_url ?? null) : null,
      teammates: (profiles ?? []).map((p) => ({
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
      })),
    };
  });

async function requireEventEditor(
  supabase: Parameters<typeof import("@/lib/events/access.server").requireEventAccess>[0],
  eventId: string,
  userId: string,
) {
  const { requireEventAccess } = await import("@/lib/events/access.server");
  const { event, access } = await requireEventAccess(supabase, eventId, userId);
  if (!access.canEdit) throw new Error("Only the Event's hosts can manage the Hackathon.");
  return { event, access };
}

const setupSchema = z.object({
  event_id: z.string().uuid(),
  full_group_meeting_at: z.string().min(1),
  teams: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        meeting_url: z.string().trim().url().max(500),
      }),
    )
    .min(HACKATHON_MIN_TEAMS)
    .max(HACKATHON_MAX_TEAMS),
});

/**
 * Create or update the Hackathon setup. Teams are reconciled by position:
 * rows sent with an id are updated in place so nobody loses their team, new
 * rows are appended, and omitted rows are removed only when empty.
 */
export const saveHackathonSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => setupSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { event } = await requireEventEditor(supabase, data.event_id, userId);

    const problems = hackathonSetupProblems(
      { full_group_meeting_at: data.full_group_meeting_at, teams: data.teams },
      event as unknown as { starts_at: string | null; ends_at: string | null },
    );
    if (problems.length) throw new Error(`This Hackathon still needs ${problems.join(", ")}.`);
    if (data.teams.some((t) => !isHttpUrl(t.meeting_url)))
      throw new Error("Room links must start with https://");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: cfgError } = await supabaseAdmin.from("event_hackathons").upsert(
      {
        event_id: data.event_id,
        full_group_meeting_at: new Date(data.full_group_meeting_at).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
    if (cfgError) throw new Error(cfgError.message);

    const { data: existing } = await supabaseAdmin
      .from("event_hackathon_teams")
      .select("id,position")
      .eq("event_id", data.event_id);
    const existingIds = new Set((existing ?? []).map((t) => t.id));
    const keptIds = new Set(data.teams.map((t) => t.id).filter(Boolean) as string[]);

    // Park survivors on negative positions first so the (event, position)
    // uniqueness never trips while the list is being re-ordered.
    for (const row of existing ?? []) {
      if (!keptIds.has(row.id)) continue;
      await supabaseAdmin
        .from("event_hackathon_teams")
        .update({ position: -Math.abs(row.position) - 1000 })
        .eq("id", row.id);
    }

    let position = 0;
    for (const team of data.teams) {
      position += 1;
      if (team.id && existingIds.has(team.id)) {
        const { error } = await supabaseAdmin
          .from("event_hackathon_teams")
          .update({
            position,
            name: team.name,
            meeting_url: team.meeting_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", team.id)
          .eq("event_id", data.event_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("event_hackathon_teams").insert({
          event_id: data.event_id,
          position,
          name: team.name,
          meeting_url: team.meeting_url,
        });
        if (error) throw new Error(error.message);
      }
    }

    // Removals last: a populated team is refused by the database, which is the
    // behaviour we want — move people off it first.
    for (const row of existing ?? []) {
      if (keptIds.has(row.id)) continue;
      const { error } = await supabaseAdmin
        .from("event_hackathon_teams")
        .delete()
        .eq("id", row.id)
        .eq("event_id", data.event_id);
      if (error)
        throw new Error(
          "A team you removed still has participants on it. Move them to another team first.",
        );
    }

    return { ok: true, team_count: data.teams.length };
  });

/** Organizer view: every team, its room link, and its full roster. */
export const getHackathonControlRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEventEditor(supabase, data.event_id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("event_hackathons")
      .select("event_id,full_group_meeting_at")
      .eq("event_id", data.event_id)
      .maybeSingle();

    const { data: teams } = await supabaseAdmin
      .from("event_hackathon_teams")
      .select("id,position,name,meeting_url")
      .eq("event_id", data.event_id)
      .order("position", { ascending: true });

    const { data: assignments } = await supabaseAdmin
      .from("event_hackathon_assignments")
      .select("user_id,team_id,assignment_source,assigned_at")
      .eq("event_id", data.event_id);

    const ids = (assignments ?? []).map((a) => a.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,username,display_name").in("id", ids)
      : { data: [] as { id: string; username: string | null; display_name: string | null }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      config: cfg ?? null,
      teams: (teams ?? []).map((t) => ({
        ...t,
        members: (assignments ?? [])
          .filter((a) => a.team_id === t.id)
          .map((a) => ({
            user_id: a.user_id,
            username: byId.get(a.user_id)?.username ?? null,
            display_name: byId.get(a.user_id)?.display_name ?? null,
            assignment_source: a.assignment_source,
            assigned_at: a.assigned_at,
          })),
      })),
    };
  });

/** Manual override. The automatic balance is a default, never a cage. */
export const moveHackathonParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        event_id: z.string().uuid(),
        user_id: z.string().uuid(),
        team_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEventEditor(supabase, data.event_id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team } = await supabaseAdmin
      .from("event_hackathon_teams")
      .select("id")
      .eq("id", data.team_id)
      .eq("event_id", data.event_id)
      .maybeSingle();
    if (!team) throw new Error("That team is not part of this Hackathon.");

    const { error } = await supabaseAdmin
      .from("event_hackathon_assignments")
      .update({
        team_id: data.team_id,
        assignment_source: "admin",
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      })
      .eq("event_id", data.event_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Turn a configured Hackathon back into an ordinary Event. */
export const removeHackathonSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEventEditor(supabase, data.event_id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("event_hackathons")
      .delete()
      .eq("event_id", data.event_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
