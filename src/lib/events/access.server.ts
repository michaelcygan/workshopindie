/**
 * The one place that decides what a viewer may do with an Event.
 *
 * Every gated read and every mutation resolves this shape first. No component
 * recomputes permissions; the UI only reflects what `EventAccess` says.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  getEventLifecycle,
  getEventMoment,
  interactionClosesAt,
  isCheckInOpen,
  isParticipationOpen,
  isRsvpOpen,
} from "@/lib/events/lifecycle";

export type { EventAccess, EventAccessRow } from "@/lib/events/access-types";
import type { EventAccess, EventAccessRow } from "@/lib/events/access-types";

const ATTENDING = new Set(["going", "maybe"]);

export async function resolveEventAccess(
  supabase: SupabaseClient<Database>,
  event: EventAccessRow,
  viewerId: string | null,
  now: Date = new Date(),
): Promise<EventAccess> {
  const lifecycle = getEventLifecycle(event, now);
  const moment = getEventMoment(event, now);

  let isAdmin = false;
  let isHost = false;
  let rsvpStatus: EventAccess["rsvpStatus"] = null;
  let isCheckedIn = false;

  if (viewerId) {
    isHost = event.created_by === viewerId;
    try {
      const [{ data: adminFlag }, { data: hostFlag }, { data: rsvp }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: viewerId, _role: "admin" }),
        isHost
          ? Promise.resolve({ data: true })
          : supabase.rpc("is_event_host", { _event_id: event.id, _user_id: viewerId }),
        supabase
          .from("group_event_rsvps")
          .select("status,checked_in_at")
          .eq("event_id", event.id)
          .eq("user_id", viewerId)
          .maybeSingle(),
      ]);
      isAdmin = Boolean(adminFlag);
      isHost = isHost || Boolean(hostFlag);
      if (rsvp) {
        rsvpStatus = (rsvp as { status: EventAccess["rsvpStatus"] }).status;
        isCheckedIn = Boolean((rsvp as { checked_in_at: string | null }).checked_in_at);
      }
    } catch {
      // Permission hiccups must never widen access — fall through as a stranger.
    }
  }

  const privileged = isAdmin || isHost;
  const isAttending = Boolean(rsvpStatus && ATTENDING.has(rsvpStatus));
  const participant = isAttending || privileged;

  const canSeeEvent = lifecycle !== "draft" || privileged;
  const participationOpen = isParticipationOpen(event, now) || (privileged && lifecycle !== "draft");

  return {
    eventId: event.id,
    lifecycle,
    moment,
    interactionClosesAt: interactionClosesAt(event),
    viewerId,
    isAdmin,
    isHost,
    rsvpStatus,
    isAttending,
    isCheckedIn,
    canSeeEvent,
    // The join link is never part of the public flyer.
    canSeeOnlineUrl: canSeeEvent && participant,
    canRsvp: Boolean(viewerId) && isRsvpOpen(event, now) && lifecycle === "published",
    canCheckIn:
      Boolean(viewerId) && isAttending && isCheckInOpen(event, now) && !isCheckedIn,
    canParticipate: participant && participationOpen,
    canSeeRoster: participant && canSeeEvent,
    canModerate: privileged,
    canEdit: privileged,
  };
}

/** Fetch the minimal row needed to resolve access. */
export async function loadEventAccessRow(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventAccessRow | null> {
  const { data } = await supabase
    .from("group_events")
    .select(
      "id,group_id,created_by,visibility,status,published_at,archived_at,starts_at,ends_at,deleted_at",
    )
    .eq("id", eventId)
    .maybeSingle();
  return (data as EventAccessRow | null) ?? null;
}

/** Convenience for mutations: load + resolve, throwing when the Event is gone. */
export async function requireEventAccess(
  supabase: SupabaseClient<Database>,
  eventId: string,
  viewerId: string | null,
  now: Date = new Date(),
): Promise<{ event: EventAccessRow; access: EventAccess }> {
  const event = await loadEventAccessRow(supabase, eventId);
  if (!event || event.deleted_at) throw new Error("Event not found");
  const access = await resolveEventAccess(supabase, event, viewerId, now);
  if (!access.canSeeEvent) throw new Error("Event not found");
  return { event, access };
}
