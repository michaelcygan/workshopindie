import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Users, Video, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHackathonConfig, getMyHackathonTeam } from "@/lib/events/hackathon.functions";
import { hackathonRoomPhase } from "@/lib/events/hackathon";
import { cn } from "@/lib/utils";

function timeLabel(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

/**
 * The participant's view of a Hackathon: how many teams there are, which one
 * is theirs, and — once the Event is live — the one room link that matters
 * right now. Everything is derived from the RSVP; there is no second signup.
 */
export function HackathonPanel({
  eventId,
  startsAt,
  timezone,
  signedIn,
  fullGroupUrl,
}: {
  eventId: string;
  startsAt: string;
  timezone?: string | null;
  signedIn: boolean;
  /** The Event's own join link, used for the full-group meeting. */
  fullGroupUrl?: string | null;
}) {
  const configFn = useServerFn(getHackathonConfig);
  const teamFn = useServerFn(getMyHackathonTeam);

  const { data: config } = useQuery({
    queryKey: ["hackathon-config", eventId],
    queryFn: () => configFn({ data: { event_id: eventId } }),
    staleTime: 60_000,
  });

  const { data: myTeam } = useQuery({
    queryKey: ["hackathon-my-team", eventId, signedIn],
    enabled: signedIn && Boolean(config),
    queryFn: () => teamFn({ data: { event_id: eventId } }),
    staleTime: 30_000,
  });

  if (!config) return null;

  const phase = hackathonRoomPhase(new Date(), startsAt, config.full_group_meeting_at);
  const teamActive = phase === "team";
  const fullGroupActive = phase === "full_group";

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-ink">Hackathon</h3>
        <p className="text-xs text-ink-muted">
          {config.team_count} team{config.team_count === 1 ? "" : "s"} · everyone regroups{" "}
          {timeLabel(config.full_group_meeting_at, timezone)}
        </p>
      </div>

      {!signedIn ? (
        <p className="mt-3 text-sm text-ink-muted">
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>{" "}
          and RSVP — you're placed on a team automatically, no separate signup.
        </p>
      ) : !myTeam ? (
        <p className="mt-3 text-sm text-ink-muted">
          RSVP to this Event and you'll be placed on the smallest team automatically. Your room link
          appears here.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div
            className={cn(
              "rounded-xl border p-4",
              teamActive ? "border-primary bg-primary/5" : "border-border bg-background",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">Your team</p>
                <p className="font-display text-base text-ink">{myTeam.name}</p>
              </div>
              {myTeam.meeting_url ? (
                <Button
                  asChild
                  size="sm"
                  variant={teamActive ? "default" : "outline"}
                  className="rounded-full"
                >
                  <a href={myTeam.meeting_url} target="_blank" rel="noopener noreferrer">
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    {teamActive ? "Join your room" : "Team room"}
                  </a>
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Lock className="h-3.5 w-3.5" /> Link opens for confirmed RSVPs
                </span>
              )}
            </div>

            {myTeam.teammates.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                {myTeam.teammates.map((t) => (
                  <li key={t.user_id} className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3 text-ink-muted" />
                    {t.username ? (
                      <Link to="/$username" params={{ username: t.username }} className="hover:underline">
                        {t.display_name || t.username}
                      </Link>
                    ) : (
                      (t.display_name ?? "Member")
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
              fullGroupActive ? "border-primary bg-primary/5" : "border-border bg-background",
            )}
          >
            <p className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <Clock className="h-3.5 w-3.5 text-ink-muted" />
              Full group at {timeLabel(config.full_group_meeting_at, timezone)}
            </p>
            {fullGroupUrl && (
              <Button
                asChild
                size="sm"
                variant={fullGroupActive ? "default" : "outline"}
                className="rounded-full"
              >
                <a href={fullGroupUrl} target="_blank" rel="noopener noreferrer">
                  <Video className="mr-1.5 h-3.5 w-3.5" /> Full-group room
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {config.teams.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {config.teams.map((t) => (
            <li
              key={t.id}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs text-ink-soft",
                myTeam?.team_id === t.id && "border-primary text-ink",
              )}
            >
              {t.name} · {t.member_count}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
