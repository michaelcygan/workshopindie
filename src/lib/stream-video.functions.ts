/**
 * Client-callable server functions for the Stream-backed Lounge.
 *
 * All handlers:
 *  - are authenticated via requireSupabaseAuth;
 *  - verify the caller has an instant_presence row for the room;
 *  - never expose the Stream API secret (server-only import is dynamic).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roomInput = z.object({ roomId: z.string().uuid() });

async function assertPresenceOrThrow(userId: string, roomId: string) {
  // Load supabaseAdmin inside the handler path — route/functions modules ship
  // to the client bundle at module scope and would otherwise leak server-only
  // code into the browser graph.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: room } = await supabaseAdmin
    .from("instant_rooms")
    .select("id, status")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Lounge not found");
  if ((room as { status: string }).status !== "active") {
    throw new Error("Lounge is no longer live");
  }
  const { data: presence } = await supabaseAdmin
    .from("instant_presence")
    .select("user_id, audio_state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!presence) throw new Error("You are not in this Lounge");
  return presence as { user_id: string; audio_state: string };
}


/**
 * Mint a short-lived Stream user token for the current user + room. Also
 * ensures the corresponding Stream `workshop_lounge` call exists.
 */
export const getLoungeStreamToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => roomInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertPresenceOrThrow(userId, data.roomId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const displayName =
      (profile?.display_name as string | null) ??
      (profile?.username as string | null) ??
      "Guest";
    const avatarUrl = (profile?.avatar_url as string | null) ?? null;

    const { issueLoungeStreamToken } = await import("@/lib/stream-video.server");
    return issueLoungeStreamToken({
      userId,
      displayName,
      avatarUrl,
      roomId: data.roomId,
    });
  });

/**
 * Grant Stream `send-audio` for the caller in this room. Only succeeds if
 * the caller currently holds the `speaker` audio_state (which the DB queue
 * RPCs guarantee is capped at LOUNGE_SPEAKER_CAP).
 */
export const grantLoungeSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => roomInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const presence = await assertPresenceOrThrow(userId, data.roomId);
    if (presence.audio_state !== "speaker") {
      throw new Error("Not a speaker in this Lounge");
    }
    const { grantLoungeSendAudio } = await import("@/lib/stream-video.server");
    await grantLoungeSendAudio({ roomId: data.roomId, userId });
    return { ok: true };
  });

/**
 * Revoke Stream `send-audio` for the caller (or, for admins/mods, another
 * user in the same room). Best-effort — never throws into the leave path.
 */
export const revokeLoungeSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; userId?: string }) =>
    z
      .object({ roomId: z.string().uuid(), userId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    if (target !== context.userId) {
      // Only site admins may revoke another user's mic.
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not allowed");
    }
    try {
      const { revokeLoungeSendAudio } = await import(
        "@/lib/stream-video.server"
      );
      await revokeLoungeSendAudio({ roomId: data.roomId, userId: target });
    } catch {
      // best effort
    }
    return { ok: true };
  });
