import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Link as LinkIcon, X, Repeat, ShieldCheck, Clock, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getLineupForEvent, getMySlotPrivate, convertMyHolds,
  releaseSlot, switchSlot, approveClaim, declineClaim, removeFromSlot, updateMyPerformerInfo,
} from "@/lib/lineup.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ClaimSlotDialog } from "./claim-slot-dialog";

type Slot = {
  id: string;
  event_id: string;
  position: number;
  status: "open" | "soft_hold" | "requested" | "confirmed";
  claimed_by: string | null;
  claimed_at: string | null;
  manual_performer_name: string | null;
  stage_name: string | null;
  act_type: "comedian" | "band" | "dj" | "other" | null;
  link_url: string | null;
  hold_expires_at: string | null;
};

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

const ACT_LABELS: Record<string, string> = {
  comedian: "Comedian",
  band: "Band",
  dj: "DJ",
  other: "Other",
};

export function LineupPanel({ eventId, isHostOrAdmin }: { eventId: string; isHostOrAdmin: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getLineupForEvent);
  const mineFn = useServerFn(getMySlotPrivate);
  const convertFn = useServerFn(convertMyHolds);
  const releaseFn = useServerFn(releaseSlot);
  const switchFn = useServerFn(switchSlot);
  const approveFn = useServerFn(approveClaim);
  const declineFn = useServerFn(declineClaim);
  const removeFn = useServerFn(removeFromSlot);
  const updateFn = useServerFn(updateMyPerformerInfo);

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimSlotId, setClaimSlotId] = useState<string | null>(null);
  const [claimPosition, setClaimPosition] = useState<number | null>(null);
  const [switchMode, setSwitchMode] = useState(false);

  const { data } = useQuery({
    queryKey: ["lineup", eventId],
    queryFn: () => getFn({ data: { event_id: eventId } }),
    refetchInterval: 30_000,
  });

  const { data: mine } = useQuery({
    queryKey: ["lineup-mine", eventId, user?.id ?? null],
    queryFn: () => mineFn({ data: { event_id: eventId } }),
    enabled: !!user,
  });

  // Convert pending soft holds after signup
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const marker = window.localStorage.getItem("pendingLineupHold");
    if (!marker) return;
    (async () => {
      try {
        const res = await convertFn({});
        if (res.converted > 0) toast.success(`Confirmed ${res.converted} held spot${res.converted === 1 ? "" : "s"}.`);
      } finally {
        window.localStorage.removeItem("pendingLineupHold");
        qc.invalidateQueries({ queryKey: ["lineup", eventId] });
        qc.invalidateQueries({ queryKey: ["lineup-mine", eventId] });
      }
    })();
  }, [user, convertFn, qc, eventId]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`lineup-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_lineup_slots", filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ["lineup", eventId] });
        qc.invalidateQueries({ queryKey: ["lineup-mine", eventId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  const slots = useMemo(() => (data?.slots ?? []) as Slot[], [data]);
  const profiles = (data?.profiles ?? {}) as Record<string, Profile>;
  const ev = data?.event as { lineup_mode: "open_claim" | "host_approval"; lineup_field_act_type: boolean; lineup_field_link: boolean; lineup_field_notes: boolean; lineup_allow_switch: boolean } | undefined;

  const mySlot = slots.find((s) => user && s.claimed_by === user.id);
  const openSlots = slots.filter((s) => s.status === "open");

  function openClaim(slot: Slot) {
    setClaimSlotId(slot.id);
    setClaimPosition(slot.position);
    setClaimOpen(true);
  }

  async function doRelease(slotId: string) {
    if (!confirm("Release your spot? It'll go back to the open pool.")) return;
    try { await releaseFn({ data: { slot_id: slotId } }); toast.success("Released."); }
    catch (ex) { toast.error((ex as Error).message); }
  }

  async function doSwitch(toSlotId: string) {
    if (!mySlot) return;
    try {
      await switchFn({ data: { from_slot_id: mySlot.id, to_slot_id: toSlotId } });
      toast.success("Switched.");
      setSwitchMode(false);
    } catch (ex) { toast.error((ex as Error).message); }
  }

  if (!ev) {
    return (
      <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
        <div className="h-20 animate-pulse rounded-xl bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-ink">Lineup</h3>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {ev.lineup_mode === "host_approval" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
              <ShieldCheck className="h-3 w-3" /> Host approval
            </span>
          )}
          <span>{slots.filter((s) => s.status === "confirmed" || s.status === "requested").length} / {slots.length} filled</span>
        </div>
      </div>

      {/* My slot card */}
      {mySlot && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Your spot · #{mySlot.position}</span>
            {mySlot.status === "requested" && <span className="text-xs text-amber-700 dark:text-amber-300">Pending host approval</span>}
            {mine && (mine as { stage_name: string | null }).stage_name && (
              <span className="text-ink-soft">as <span className="font-medium text-ink">{(mine as { stage_name: string }).stage_name}</span></span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {ev.lineup_allow_switch && openSlots.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => setSwitchMode((v) => !v)}>
                  <Repeat className="mr-1 h-3 w-3" /> {switchMode ? "Cancel switch" : "Switch slot"}
                </Button>
              )}
              <EditMyInfoButton slotId={mySlot.id} eventId={eventId} fields={{ act_type: ev.lineup_field_act_type, link: ev.lineup_field_link, notes: ev.lineup_field_notes }} updateFn={updateFn} onSaved={() => qc.invalidateQueries({ queryKey: ["lineup-mine", eventId] })} initial={mine as never} />
              <Button size="sm" variant="ghost" className="h-7 rounded-full text-destructive" onClick={() => doRelease(mySlot.id)}>
                <X className="mr-1 h-3 w-3" /> Release
              </Button>
            </div>
          </div>
          {switchMode && (
            <p className="mt-2 text-xs text-ink-muted">Pick an open slot below to move there.</p>
          )}
        </div>
      )}

      {/* Slots */}
      {slots.length === 0 ? (
        <p className="text-sm text-ink-muted">No slots yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
          {slots.map((s) => {
            const isMine = !!user && s.claimed_by === user.id;
            const profile = s.claimed_by ? profiles[s.claimed_by] : null;
            const performerName = s.stage_name || s.manual_performer_name || profile?.display_name || profile?.username || null;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  s.status === "confirmed" ? "bg-primary text-primary-foreground" :
                  s.status === "requested" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                  s.status === "soft_hold" ? "bg-muted text-ink-muted" :
                  "border border-dashed border-border text-ink-muted",
                )}>
                  {s.position}
                </div>
                <div className="min-w-0 flex-1">
                  {s.status === "open" && (
                    <span className="text-sm text-ink-muted">Open</span>
                  )}
                  {s.status === "soft_hold" && (
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                      <Clock className="h-3 w-3" /> Holding…
                    </span>
                  )}
                  {(s.status === "confirmed" || s.status === "requested") && (
                    <div className="flex flex-wrap items-center gap-2">
                      {profile?.avatar_url && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={profile.avatar_url} />
                          <AvatarFallback>{(performerName ?? "?").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                      )}
                      <span className="truncate text-sm font-medium text-ink">{performerName ?? "Performer"}</span>
                      {s.act_type && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{ACT_LABELS[s.act_type]}</span>
                      )}
                      {s.manual_performer_name && (
                        <span className="text-[10px] text-ink-muted">(added by host)</span>
                      )}
                      {s.status === "requested" && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Requested</span>
                      )}
                      {s.link_url && (
                        <a href={s.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                          <LinkIcon className="h-3 w-3" /> link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {s.status === "open" && !mySlot && !switchMode && (
                    <Button size="sm" className="h-8 rounded-full" onClick={() => openClaim(s)}>
                      Claim
                    </Button>
                  )}
                  {s.status === "open" && switchMode && (
                    <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => doSwitch(s.id)}>
                      Move here
                    </Button>
                  )}
                  {isMine && s.status !== "open" && (
                    <span className="text-[10px] text-primary">You</span>
                  )}
                  {isHostOrAdmin && (s.status === "requested" || s.status === "confirmed" || s.status === "soft_hold") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {s.status === "requested" && (
                          <>
                            <DropdownMenuItem onClick={async () => { await approveFn({ data: { event_id: eventId, slot_id: s.id } }); toast.success("Approved"); }}>
                              <Check className="mr-2 h-3.5 w-3.5" /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => { await declineFn({ data: { event_id: eventId, slot_id: s.id } }); toast.success("Declined"); }}>
                              <X className="mr-2 h-3.5 w-3.5" /> Decline
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={async () => { if (!confirm("Remove this performer?")) return; await removeFn({ data: { event_id: eventId, slot_id: s.id } }); toast.success("Removed"); }} className="text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ClaimSlotDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        slotId={claimSlotId}
        position={claimPosition}
        mode={ev.lineup_mode}
        fields={{ act_type: ev.lineup_field_act_type, link: ev.lineup_field_link, notes: ev.lineup_field_notes }}
        onClaimed={() => {
          qc.invalidateQueries({ queryKey: ["lineup", eventId] });
          qc.invalidateQueries({ queryKey: ["lineup-mine", eventId] });
        }}
      />
    </div>
  );
}

function EditMyInfoButton({
  slotId, eventId, fields, updateFn, onSaved, initial,
}: {
  slotId: string;
  eventId: string;
  fields: LineupFieldsConfigLite;
  updateFn: (args: { data: { slot_id: string; performer: { stage_name: string | null; act_type: "comedian" | "band" | "dj" | "other" | null; link_url: string | null; notes_to_host: string | null } } }) => Promise<unknown>;
  onSaved: () => void;
  initial: { stage_name: string | null; act_type: "comedian" | "band" | "dj" | "other" | null; link_url: string | null; notes_to_host: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(initial?.stage_name ?? "");
  const [actType, setActType] = useState<string>(initial?.act_type ?? "");
  const [link, setLink] = useState(initial?.link_url ?? "");
  const [notes, setNotes] = useState(initial?.notes_to_host ?? "");
  void eventId;
  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => setOpen(true)}>Edit</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <h4 className="mb-3 font-display text-lg text-ink">Edit your info</h4>
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-ink-muted">Stage name</label>
                <input className="w-full rounded-md border border-border bg-background px-2 py-1.5" value={stage} onChange={(e) => setStage(e.target.value)} maxLength={80} />
              </div>
              {fields.act_type && (
                <div>
                  <label className="text-xs text-ink-muted">Act type</label>
                  <select className="w-full rounded-md border border-border bg-background px-2 py-1.5" value={actType} onChange={(e) => setActType(e.target.value)}>
                    <option value="">—</option>
                    <option value="comedian">Comedian</option>
                    <option value="band">Band</option>
                    <option value="dj">DJ</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              {fields.link && (
                <div>
                  <label className="text-xs text-ink-muted">Link</label>
                  <input type="url" className="w-full rounded-md border border-border bg-background px-2 py-1.5" value={link} onChange={(e) => setLink(e.target.value)} />
                </div>
              )}
              {fields.notes && (
                <div>
                  <label className="text-xs text-ink-muted">Notes to host (private)</label>
                  <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2 py-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                try {
                  await updateFn({ data: { slot_id: slotId, performer: {
                    stage_name: stage || null,
                    act_type: (actType || null) as "comedian" | "band" | "dj" | "other" | null,
                    link_url: link || null,
                    notes_to_host: notes || null,
                  } } });
                  toast.success("Updated");
                  onSaved();
                  setOpen(false);
                } catch (ex) { toast.error((ex as Error).message); }
              }}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type LineupFieldsConfigLite = { act_type: boolean; link: boolean; notes: boolean };
