import { evaluateVenuePolicy, getWorkshopVenue } from "@/lib/events/workshop-venues";

/**
 * Reconcile the canonical Workshop venue reference with the Event's own venue
 * snapshot, then enforce the venue's published group policy server-side so a
 * stale or modified client can never bypass it.
 *
 * - A hand-edited name/address detaches the canonical key (the snapshot stays
 *   authoritative for that occurrence).
 * - Reaching a published group-policy trigger, or an unverified walk-in
 *   policy, blocks publication until an admin explicitly confirms they went
 *   through the venue's own reservation / Host an Event flow.
 */
export function reconcileVenue(input: {
  workshop_venue_key?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  capacity?: number | null;
  overflow?: number | null;
  venue_policy_confirmed?: boolean;
  status: string;
}): { key: string | null; policy: ReturnType<typeof evaluateVenuePolicy> } {
  const venue = getWorkshopVenue(input.workshop_venue_key);
  let key = venue?.key ?? null;
  if (venue) {
    const nameChanged =
      input.venue_name != null && input.venue_name.trim() !== venue.venue_name;
    const addressChanged =
      input.venue_address != null && input.venue_address.trim() !== venue.address;
    if (nameChanged || addressChanged) key = null;
  }
  const policy = evaluateVenuePolicy({
    key,
    capacity: input.capacity ?? null,
    overflow: input.overflow ?? 0,
    confirmed: input.venue_policy_confirmed === true,
  });
  if (input.status !== "draft" && policy.requiresReview) {
    throw new Error(
      `${policy.reason} Confirm the venue policy for this occurrence to publish it anyway.`,
    );
  }
  return { key, policy };
}
