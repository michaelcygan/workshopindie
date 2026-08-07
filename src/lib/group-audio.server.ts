/**
 * Server-only helpers for Group audio admission.
 *
 * Kept out of `group-audio.functions.ts` so server-fn splitting never drops
 * these sibling declarations at runtime.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOUNGE_CAP } from "@/lib/lounge-constants";

export type GroupAudioAdmission = {
  roomId: string;
  groupId: string;
};

/**
 * Verify the caller may enter this Group's audio and hand back the group row.
 * Never adds the caller to the Group as a side effect.
 */
export async function assertGroupAudioAccess(userId: string, groupId: string) {
  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id, slug, name, visibility")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) throw new Error("Group not found");

  const { data: membership } = await supabaseAdmin
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("Join this Group to use audio");

  return { group, membership };
}

/**
 * Find or create the right Group audio room, then atomically claim a seat.
 * Overflow is an internal transport detail: if the matched room fills between
 * matchmaking and the seat claim we retry, excluding the full room.
 */
export async function admitToGroupAudio(
  userId: string,
  groupId: string,
): Promise<GroupAudioAdmission> {
  const exclude: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: roomId, error } = await supabaseAdmin.rpc("join_group_lounge", {
      _user_id: userId,
      _group_id: groupId,
      _exclude_room_ids: exclude,
    } as never);
    if (error || !roomId) {
      throw new Error(error?.message ?? "Couldn't open Group audio");
    }

    const { data: admitted, error: claimError } = await supabaseAdmin.rpc("claim_lounge_slot", {
      _room_id: roomId as string,
      _user_id: userId,
      _cap: LOUNGE_CAP,
    } as never);
    if (claimError) throw new Error(claimError.message);
    if (admitted) return { roomId: roomId as string, groupId };

    exclude.push(roomId as string);
  }

  throw new Error("Group audio is full right now — try again in a moment");
}

/** Drop the caller's audio seat and any speaker state for this room. */
export async function leaveGroupAudioRoom(userId: string, roomId: string) {
  await supabaseAdmin.rpc("release_lounge_audio_slot", { _room_id: roomId } as never);
  await supabaseAdmin.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", userId);
}
