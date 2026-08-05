/**
 * Client-safe shapes for Event access. The resolver itself is server-only
 * (`access.server.ts`); these types are shared with components.
 */
import type { EventLifecycle, EventMoment, LifecycleInput } from "@/lib/events/lifecycle";

export type EventAccessRow = LifecycleInput & {
  id: string;
  group_id: string;
  created_by: string | null;
  visibility: string;
};

export type EventAccess = {
  eventId: string;
  lifecycle: EventLifecycle;
  moment: EventMoment;
  /** ms epoch when Wall/Gallery freeze. */
  interactionClosesAt: number | null;
  viewerId: string | null;
  isAdmin: boolean;
  isHost: boolean;
  /** RSVP row status, if any. */
  rsvpStatus: "going" | "maybe" | "waitlist" | "declined" | "canceled" | null;
  /** Confirmed attendance — the key that unlocks participation. */
  isAttending: boolean;
  isCheckedIn: boolean;
  canSeeEvent: boolean;
  canSeeOnlineUrl: boolean;
  canRsvp: boolean;
  canCheckIn: boolean;
  canParticipate: boolean;
  canSeeRoster: boolean;
  canModerate: boolean;
  canEdit: boolean;
};
