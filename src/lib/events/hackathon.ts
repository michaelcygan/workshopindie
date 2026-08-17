/**
 * Client-safe Hackathon vocabulary and pure rules.
 *
 * A Workshop Hackathon is not a new primitive: it is an Event of kind
 * `hackathon` that also has a configuration row. Everything here is pure so
 * the same rules render on the client and gate on the server.
 */

export const HACKATHON_MIN_TEAMS = 2;
export const HACKATHON_MAX_TEAMS = 20;

export type HackathonTeamPublic = {
  id: string;
  position: number;
  name: string;
  member_count: number;
};

export type HackathonPublicConfig = {
  event_id: string;
  full_group_meeting_at: string;
  team_count: number;
  teams: HackathonTeamPublic[];
};

export type HackathonMyTeam = {
  team_id: string;
  position: number;
  name: string;
  /** Only ever populated for a confirmed member of that team. */
  meeting_url: string | null;
  teammates: { user_id: string; username: string | null; display_name: string | null }[];
};

/** Which room a participant should be pointed at right now. */
export type HackathonRoomPhase = "before" | "team" | "full_group";

export function hackathonRoomPhase(
  now: Date,
  startsAt: string | Date,
  fullGroupMeetingAt: string | Date,
): HackathonRoomPhase {
  const t = now.getTime();
  const start = new Date(startsAt).getTime();
  const full = new Date(fullGroupMeetingAt).getTime();
  if (Number.isFinite(full) && t >= full) return "full_group";
  if (Number.isFinite(start) && t >= start) return "team";
  return "before";
}

export function defaultTeamName(position: number) {
  return `Team ${position}`;
}

/** Seats per team, rounded up — what an organizer needs to see while planning. */
export function seatsPerTeam(seats: number | null, teamCount: number) {
  if (!seats || teamCount < 1) return null;
  return Math.ceil(seats / teamCount);
}

export type HackathonSetupDraft = {
  full_group_meeting_at: string | null;
  teams: { id?: string; name: string; meeting_url: string | null }[];
};

/**
 * Everything that must be true before a Hackathon is safe to publish.
 * Returned as plain sentences so the admin surface can print them as-is.
 */
export function hackathonSetupProblems(
  draft: HackathonSetupDraft,
  event: { starts_at?: string | null; ends_at?: string | null },
): string[] {
  const problems: string[] = [];
  const count = draft.teams.length;
  if (count < HACKATHON_MIN_TEAMS) problems.push(`at least ${HACKATHON_MIN_TEAMS} teams`);
  if (count > HACKATHON_MAX_TEAMS) problems.push(`no more than ${HACKATHON_MAX_TEAMS} teams`);

  if (draft.teams.some((t) => !t.name.trim())) problems.push("a name on every team");

  const names = draft.teams.map((t) => t.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) problems.push("team names that are all different");

  if (draft.teams.some((t) => !t.meeting_url || !isHttpUrl(t.meeting_url)))
    problems.push("a working room link (https://…) on every team");

  if (!draft.full_group_meeting_at) {
    problems.push("a full-group meeting time");
  } else {
    const full = new Date(draft.full_group_meeting_at).getTime();
    if (!Number.isFinite(full)) {
      problems.push("a valid full-group meeting time");
    } else {
      const start = event.starts_at ? new Date(event.starts_at).getTime() : NaN;
      const end = event.ends_at ? new Date(event.ends_at).getTime() : NaN;
      if (Number.isFinite(start) && full < start)
        problems.push("a full-group meeting time at or after the start");
      if (Number.isFinite(end) && full > end)
        problems.push("a full-group meeting time before the Event ends");
    }
  }
  return problems;
}

export function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
