/**
 * Server-only Hackathon data layer. Every room link read or write lives here,
 * behind an explicit editor/participant check — the browser has no read grant
 * on `event_hackathon_teams.meeting_url` at all.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hackathonSetupProblems,
  isHttpUrl,
  type HackathonMyTeam,
  type HackathonPublicConfig,
} from "@/lib/events/hackathon";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function publicClient(): Client {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

async function teamCounts(eventId: string): Promise<Map<string, number>> {
  const db = await admin();
  const { data } = await db
    .from("event_hackathon_assignments")
    .select("team_id")
    .eq("event_id", eventId);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(row.team_id, (map.get(row.team_id) ?? 0) + 1);
  return map;
}

async function loadProfiles(ids: string[]) {
  if (!ids.length) return new Map<string, { username: string | null; display_name: string | null }>();
  const db = await admin();
  const { data } = await db.from("profiles").select("id,username,display_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, { username: p.username, display_name: p.display_name }]));
}

export async function loadPublicConfig(eventId: string): Promise<HackathonPublicConfig | null> {
  const supabase = publicClient();
  const { data: cfg } = await supabase
    .from("event_hackathons")
    .select("event_id,full_group_meeting_at")
    .eq("event_id", eventId)
    .maybeSingle();
  if (!cfg) return null;

  const { data: teams } = await supabase
    .from("event_hackathon_teams")
    .select("id,position,name")
    .eq("event_id", eventId)
    .order("position", { ascending: true });

  const counts = await teamCounts(eventId);
  const rows = teams ?? [];
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
}

export async function loadMyTeam(
  supabase: Client,
  eventId: string,
  userId: string,
): Promise<HackathonMyTeam | null> {
  const { requireEventAccess } = await import("@/lib/events/access.server");
  const { access } = await requireEventAccess(supabase, eventId, userId);
  if (!access.canSeeEvent) return null;

  const db = await admin();
  const { data: mine } = await db
    .from("event_hackathon_assignments")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mine) return null;

  const { data: team } = await db
    .from("event_hackathon_teams")
    .select("id,position,name,meeting_url")
    .eq("id", mine.team_id)
    .maybeSingle();
  if (!team) return null;

  const { data: roster } = await db
    .from("event_hackathon_assignments")
    .select("user_id")
    .eq("team_id", team.id);
  const ids = (roster ?? []).map((r) => r.user_id);
  const profiles = await loadProfiles(ids);

  return {
    team_id: team.id,
    position: team.position,
    name: team.name,
    // Only a confirmed participant ever receives the room link.
    meeting_url: access.isAttending ? (team.meeting_url ?? null) : null,
    teammates: ids.map((id) => ({
      user_id: id,
      username: profiles.get(id)?.username ?? null,
      display_name: profiles.get(id)?.display_name ?? null,
    })),
  };
}

async function requireEditor(supabase: Client, eventId: string, userId: string) {
  const { requireEventAccess } = await import("@/lib/events/access.server");
  const { event, access } = await requireEventAccess(supabase, eventId, userId);
  if (!access.canEdit) throw new Error("Only this Event's hosts can manage the Hackathon.");
  return event as unknown as { starts_at: string | null; ends_at: string | null };
}

export type SaveSetupInput = {
  event_id: string;
  full_group_meeting_at: string;
  teams: { id?: string; name: string; meeting_url: string }[];
};

export async function saveSetup(supabase: Client, userId: string, input: SaveSetupInput) {
  const event = await requireEditor(supabase, input.event_id, userId);

  const problems = hackathonSetupProblems(
    { full_group_meeting_at: input.full_group_meeting_at, teams: input.teams },
    event,
  );
  if (problems.length) throw new Error(`This Hackathon still needs ${problems.join(", ")}.`);
  if (input.teams.some((t) => !isHttpUrl(t.meeting_url)))
    throw new Error("Room links must start with https://");

  const db = await admin();
  const now = new Date().toISOString();

  const { error: cfgError } = await db.from("event_hackathons").upsert(
    {
      event_id: input.event_id,
      full_group_meeting_at: new Date(input.full_group_meeting_at).toISOString(),
      updated_at: now,
    },
    { onConflict: "event_id" },
  );
  if (cfgError) throw new Error(cfgError.message);

  const { data: existing } = await db
    .from("event_hackathon_teams")
    .select("id,position")
    .eq("event_id", input.event_id);
  const existingIds = new Set((existing ?? []).map((t) => t.id));
  const keptIds = new Set(input.teams.map((t) => t.id).filter(Boolean) as string[]);

  // Park survivors out of the way first, so re-ordering never collides with
  // the (event, position) uniqueness constraint mid-flight.
  for (const row of existing ?? []) {
    if (!keptIds.has(row.id)) continue;
    await db
      .from("event_hackathon_teams")
      .update({ position: -Math.abs(row.position) - 1000 })
      .eq("id", row.id);
  }

  let position = 0;
  for (const team of input.teams) {
    position += 1;
    if (team.id && existingIds.has(team.id)) {
      const { error } = await db
        .from("event_hackathon_teams")
        .update({ position, name: team.name, meeting_url: team.meeting_url, updated_at: now })
        .eq("id", team.id)
        .eq("event_id", input.event_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("event_hackathon_teams").insert({
        event_id: input.event_id,
        position,
        name: team.name,
        meeting_url: team.meeting_url,
      });
      if (error) throw new Error(error.message);
    }
  }

  // Removals last. The database refuses to drop a populated team, which is
  // exactly the guardrail an organizer wants.
  for (const row of existing ?? []) {
    if (keptIds.has(row.id)) continue;
    const { error } = await db
      .from("event_hackathon_teams")
      .delete()
      .eq("id", row.id)
      .eq("event_id", input.event_id);
    if (error)
      throw new Error(
        "A team you removed still has participants on it. Move them to another team first.",
      );
  }

  return { ok: true as const, team_count: input.teams.length };
}

export async function loadControlRoom(supabase: Client, eventId: string, userId: string) {
  await requireEditor(supabase, eventId, userId);
  const db = await admin();

  const { data: cfg } = await db
    .from("event_hackathons")
    .select("event_id,full_group_meeting_at")
    .eq("event_id", eventId)
    .maybeSingle();

  const { data: teams } = await db
    .from("event_hackathon_teams")
    .select("id,position,name,meeting_url")
    .eq("event_id", eventId)
    .order("position", { ascending: true });

  const { data: assignments } = await db
    .from("event_hackathon_assignments")
    .select("user_id,team_id,assignment_source,assigned_at")
    .eq("event_id", eventId);

  const profiles = await loadProfiles((assignments ?? []).map((a) => a.user_id));

  return {
    config: cfg ?? null,
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      position: t.position,
      name: t.name,
      meeting_url: t.meeting_url,
      members: (assignments ?? [])
        .filter((a) => a.team_id === t.id)
        .map((a) => ({
          user_id: a.user_id,
          username: profiles.get(a.user_id)?.username ?? null,
          display_name: profiles.get(a.user_id)?.display_name ?? null,
          assignment_source: a.assignment_source,
          assigned_at: a.assigned_at,
        })),
    })),
  };
}

export async function moveParticipant(
  supabase: Client,
  userId: string,
  input: { event_id: string; user_id: string; team_id: string },
) {
  await requireEditor(supabase, input.event_id, userId);
  const db = await admin();

  const { data: team } = await db
    .from("event_hackathon_teams")
    .select("id")
    .eq("id", input.team_id)
    .eq("event_id", input.event_id)
    .maybeSingle();
  if (!team) throw new Error("That team is not part of this Hackathon.");

  const { error } = await db
    .from("event_hackathon_assignments")
    .update({
      team_id: input.team_id,
      assignment_source: "admin",
      assigned_by: userId,
      assigned_at: new Date().toISOString(),
    })
    .eq("event_id", input.event_id)
    .eq("user_id", input.user_id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function removeSetup(supabase: Client, eventId: string, userId: string) {
  await requireEditor(supabase, eventId, userId);
  const db = await admin();
  const { error } = await db.from("event_hackathons").delete().eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
