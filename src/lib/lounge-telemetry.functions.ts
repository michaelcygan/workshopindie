/**
 * Authenticated telemetry sink for Lounge audio events.
 *
 * The client-side `emitLoungeAudioEvent` calls this fire-and-forget for the
 * signed-in user; row `user_id` is always the caller (never client-supplied).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KNOWN_EVENTS = [
  "stream_listener_join_ok",
  "stream_listener_join_fail",
  "audio_reconnect",
  "mic_request",
  "mic_offer",
  "mic_permission_denied",
  "speaker_join",
  "speaker_leave",
  "queue_abandon",
  "connected_minutes",
] as const;

const inputSchema = z.object({
  event: z.enum(KNOWN_EVENTS),
  roomId: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const logLoungeAudioEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    event: (typeof KNOWN_EVENTS)[number];
    roomId?: string | null;
    payload?: Record<string, unknown>;
  }) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Best-effort insert; never let telemetry break the audio path.
    await supabase.from("lounge_audio_events").insert({
      room_id: data.roomId ?? null,
      user_id: userId,
      event: data.event,
      // Data API types payload jsonb as Json; cast at the boundary.
      payload: JSON.parse(JSON.stringify(data.payload ?? {})),
    });
    return { ok: true };
  });
