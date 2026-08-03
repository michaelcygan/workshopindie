/**
 * Read-only live-audio state for a Group. Safe for signed-out viewers:
 * returns counts only, never identities or room internals beyond the room id.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GroupAudioState = {
  live: boolean;
  roomId: string | null;
  connectedCount: number;
  speakingCount: number;
};

const LIVE_WINDOW_MS = 5 * 60 * 1000;

export async function readGroupAudioState(groupId: string): Promise<GroupAudioState> {
  const empty: GroupAudioState = {
    live: false,
    roomId: null,
    connectedCount: 0,
    speakingCount: 0,
  };

  const { data: rooms } = await supabaseAdmin
    .from("instant_rooms")
    .select("id")
    .eq("kind", "lounge")
    .eq("group_id", groupId)
    .eq("status", "active");
  if (!rooms?.length) return empty;

  const cutoff = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const { data: presence } = await supabaseAdmin
    .from("instant_presence")
    .select("room_id, user_id, audio_state")
    .in(
      "room_id",
      rooms.map((r) => r.id as string),
    )
    .gt("last_seen_at", cutoff);

  if (!presence?.length) return empty;

  // Dedupe by user across overflow rooms — overflow is an internal detail.
  const seen = new Set<string>();
  let speaking = 0;
  const perRoom = new Map<string, number>();
  for (const row of presence) {
    const uid = row.user_id as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    if (row.audio_state === "speaker") speaking += 1;
    const rid = row.room_id as string;
    perRoom.set(rid, (perRoom.get(rid) ?? 0) + 1);
  }

  // Surface the busiest room as "the" Group session.
  let primary: string | null = null;
  let best = -1;
  for (const [rid, count] of perRoom) {
    if (count > best) {
      best = count;
      primary = rid;
    }
  }

  return {
    live: seen.size > 0,
    roomId: primary,
    connectedCount: seen.size,
    speakingCount: speaking,
  };
}
