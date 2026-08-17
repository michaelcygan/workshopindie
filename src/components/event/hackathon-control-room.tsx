import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getHackathonControlRoom,
  moveHackathonParticipant,
  removeHackathonSetup,
  saveHackathonSetup,
} from "@/lib/events/hackathon.functions";
import {
  HACKATHON_MAX_TEAMS,
  HACKATHON_MIN_TEAMS,
  defaultTeamName,
  hackathonSetupProblems,
  seatsPerTeam,
} from "@/lib/events/hackathon";

type TeamDraft = { id?: string; name: string; meeting_url: string };

/** Local datetime value for <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Everything an organizer needs for a Hackathon in one place: teams and their
 * rooms, the full-group time, and the live roster with manual moves.
 */
export function HackathonControlRoom({
  eventId,
  eventTitle,
  startsAt,
  endsAt,
  seats,
}: {
  eventId: string;
  eventTitle: string;
  startsAt: string | null;
  endsAt: string | null;
  seats?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const loadFn = useServerFn(getHackathonControlRoom);
  const saveFn = useServerFn(saveHackathonSetup);
  const moveFn = useServerFn(moveHackathonParticipant);
  const removeFn = useServerFn(removeHackathonSetup);

  const { data, isLoading } = useQuery({
    queryKey: ["hackathon-control-room", eventId],
    enabled: open,
    queryFn: () => loadFn({ data: { event_id: eventId } }),
  });

  const [fullGroupAt, setFullGroupAt] = useState("");
  const [teams, setTeams] = useState<TeamDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullGroupAt(toLocalInput(data.config?.full_group_meeting_at ?? startsAt));
    setTeams(
      data.teams.length
        ? data.teams.map((t) => ({ id: t.id, name: t.name, meeting_url: t.meeting_url ?? "" }))
        : [
            { name: defaultTeamName(1), meeting_url: "" },
            { name: defaultTeamName(2), meeting_url: "" },
          ],
    );
  }, [data, startsAt]);

  const problems = hackathonSetupProblems(
    { full_group_meeting_at: fullGroupAt || null, teams },
    { starts_at: startsAt, ends_at: endsAt },
  );
  const perTeam = seatsPerTeam(seats ?? null, teams.length);

  async function save() {
    if (problems.length) {
      toast.error(`This Hackathon still needs ${problems.join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          event_id: eventId,
          full_group_meeting_at: new Date(fullGroupAt).toISOString(),
          teams: teams.map((t) => ({
            ...(t.id ? { id: t.id } : {}),
            name: t.name.trim(),
            meeting_url: t.meeting_url.trim(),
          })),
        },
      });
      toast.success("Hackathon saved. New RSVPs are placed automatically.");
      qc.invalidateQueries({ queryKey: ["hackathon-control-room", eventId] });
      qc.invalidateQueries({ queryKey: ["hackathon-config", eventId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the Hackathon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="mr-1 h-7 rounded-md" title="Manage Hackathon">
          <Users2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Hackathon · {eventTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="space-y-6">
            <div>
              <Label className="text-xs">Full-group meeting</Label>
              <Input
                type="datetime-local"
                value={fullGroupAt}
                onChange={(e) => setFullGroupAt(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-ink-muted">
                Until this moment, participants are pointed at their team room. After it, at the
                Event's own join link.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Teams</Label>
                <p className="text-[11px] text-ink-muted">
                  {teams.length} team{teams.length === 1 ? "" : "s"}
                  {perTeam ? ` · about ${perTeam} people each` : ""}
                </p>
              </div>
              {teams.map((team, i) => (
                <div key={team.id ?? `new-${i}`} className="flex items-start gap-2">
                  <Input
                    value={team.name}
                    placeholder={defaultTeamName(i + 1)}
                    onChange={(e) =>
                      setTeams(teams.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))
                    }
                    className="w-40"
                  />
                  <Input
                    value={team.meeting_url}
                    placeholder="https://meet.example.com/room"
                    onChange={(e) =>
                      setTeams(
                        teams.map((t, j) => (j === i ? { ...t, meeting_url: e.target.value } : t)),
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive"
                    disabled={teams.length <= HACKATHON_MIN_TEAMS}
                    onClick={() => setTeams(teams.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={teams.length >= HACKATHON_MAX_TEAMS}
                onClick={() =>
                  setTeams([...teams, { name: defaultTeamName(teams.length + 1), meeting_url: "" }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add team
              </Button>
            </div>

            {problems.length > 0 && (
              <p className="rounded-xl border border-dashed border-border bg-background p-3 text-xs text-ink-muted">
                Still needs {problems.join(", ")}.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving || problems.length > 0} className="rounded-full">
                {saving ? "Saving…" : "Save Hackathon"}
              </Button>
              {data?.config && (
                <Button
                  variant="ghost"
                  className="rounded-full text-destructive"
                  onClick={async () => {
                    if (!confirm("Remove the Hackathon setup? Teams and placements are deleted."))
                      return;
                    await removeFn({ data: { event_id: eventId } });
                    qc.invalidateQueries({ queryKey: ["hackathon-control-room", eventId] });
                    qc.invalidateQueries({ queryKey: ["hackathon-config", eventId] });
                    toast.success("Hackathon setup removed.");
                  }}
                >
                  Remove setup
                </Button>
              )}
            </div>

            {data?.teams.some((t) => t.members.length > 0) && (
              <div className="space-y-3 border-t border-border pt-4">
                <Label className="text-xs">Roster</Label>
                {data.teams.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium text-ink">
                      {t.name} · {t.members.length}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {t.members.map((m) => (
                        <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink-soft">
                            {m.display_name || m.username || m.user_id.slice(0, 8)}
                            {m.assignment_source === "admin" ? " · moved" : ""}
                          </span>
                          <Select
                            value={t.id}
                            onValueChange={async (teamId) => {
                              if (teamId === t.id) return;
                              await moveFn({
                                data: { event_id: eventId, user_id: m.user_id, team_id: teamId },
                              });
                              qc.invalidateQueries({
                                queryKey: ["hackathon-control-room", eventId],
                              });
                              toast.success("Moved.");
                            }}
                          >
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {data.teams.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
