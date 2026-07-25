// Single-sharer screen-share lease for Lounge rooms.
// The `instant_rooms.screen_sharer_user_id` column is the source of truth;
// these helpers wrap the SECURITY DEFINER RPCs so client code doesn't need to
// know about the underlying columns or advisory locks.

import { supabase } from "@/integrations/supabase/client";

export type LeaseClaimResult =
  | { ok: true; sharer: string }
  | { ok: false; reason: "busy"; holder: string | null }
  | { ok: false; reason: "not_in_room" }
  | { ok: false; reason: "error"; message: string };

export async function claimLoungeScreenShare(
  roomId: string,
  userId: string,
): Promise<LeaseClaimResult> {
  const { data, error } = await supabase.rpc("claim_lounge_screen_share", {
    _room_id: roomId,
    _user_id: userId,
  });
  if (error) return { ok: false, reason: "error", message: error.message };
  const payload = (data ?? {}) as { status?: string; sharer?: string | null };
  if (payload.status === "claimed") return { ok: true, sharer: payload.sharer ?? userId };
  if (payload.status === "busy") return { ok: false, reason: "busy", holder: payload.sharer ?? null };
  if (payload.status === "not_in_room") return { ok: false, reason: "not_in_room" };
  return { ok: false, reason: "error", message: `Unexpected status: ${payload.status ?? "?"}` };
}

export async function refreshLoungeScreenShare(
  roomId: string,
  userId: string,
): Promise<"ok" | "lost" | "error"> {
  const { data, error } = await supabase.rpc("refresh_lounge_screen_share", {
    _room_id: roomId,
    _user_id: userId,
  });
  if (error) return "error";
  const status = (data as { status?: string } | null)?.status;
  return status === "ok" ? "ok" : status === "lost" ? "lost" : "error";
}

export async function releaseLoungeScreenShare(
  roomId: string,
  userId: string,
): Promise<void> {
  // Fire-and-forget: any failure is recoverable by the 45s staleness window.
  try {
    await supabase.rpc("release_lounge_screen_share", {
      _room_id: roomId,
      _user_id: userId,
    });
  } catch {
    /* noop */
  }
}

// Heartbeat cadence — well under the 45s server-side staleness threshold so a
// briefly backgrounded tab still keeps the lease.
export const LEASE_HEARTBEAT_MS = 20_000;
