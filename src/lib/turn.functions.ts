import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Mint short-lived TURN credentials from Cloudflare Realtime.
 * Only called when a peer-to-peer WebRTC connection has failed and we need
 * a relay fallback. Rate-limited per user to cap relay spend.
 */
export const mintTurnCreds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roomId: z.string().uuid().optional(),
        ttlSeconds: z.number().int().min(60).max(3600).optional(),
        envMode: z.enum(["auto", "force-turn", "direct-only"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ttl = data.ttlSeconds ?? 600;
    const envMode = data.envMode ?? "auto";

    // Rate limit: max 10 mints per user per hour.
    const { data: allowed, error: rlErr } = await supabaseAdmin.rpc("check_and_bump", {
      _action: "mint_turn",
      _key: userId,
      _window_s: 3600,
      _max: 10,
    });
    if (rlErr) throw new Error(rlErr.message);
    if (allowed === false) throw new Error("Too many relay requests, try again later.");

    const tokenId = process.env.CLOUDFLARE_REALTIME_TURN_TOKEN_ID;
    const apiToken = process.env.CLOUDFLARE_REALTIME_TURN_API_TOKEN;
    if (!tokenId || !apiToken) throw new Error("TURN service not configured");

    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Cloudflare TURN error", res.status, text);
      throw new Error("Couldn't mint relay credentials");
    }

    const body = (await res.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
    const iceServers = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];

    // Server-side shape validation so the client always gets a usable list
    // and a malformed Cloudflare response fails loudly rather than silently
    // leaving the pair on STUN-only.
    const looksValid =
      iceServers.length > 0 &&
      iceServers.every(
        (s) =>
          s &&
          typeof s === "object" &&
          "urls" in s &&
          (typeof (s as RTCIceServer).urls === "string" ||
            Array.isArray((s as RTCIceServer).urls)),
      );
    if (!looksValid) {
      console.error("Cloudflare TURN response malformed (no usable iceServers)");
      throw new Error("Couldn't mint relay credentials");
    }

    // Cost-visibility log (best-effort). Never log credential fields.
    await supabaseAdmin
      .from("turn_credential_grants")
      .insert({
        user_id: userId,
        room_id: data.roomId ?? null,
        ttl_seconds: ttl,
        env_mode: envMode,
      })
      .then(
        () => undefined,
        (e) => console.warn("turn_credential_grants insert failed", e),
      );

    return {
      iceServers,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  });

// -----------------------------------------------------------------------------
// WebRTC connection telemetry (privacy-safe).
// The client submits one row per peer when the pair reaches connected, and
// updates it when a relayed pair closes so we can size Cloudflare TURN egress.
// No IPs, SDP, addresses, or peer identifiers are recorded.
// -----------------------------------------------------------------------------

const candidateTypeSchema = z.enum(["host", "srflx", "prflx", "relay"]).optional();
const pathKindSchema = z.enum(["direct", "relayed", "failed"]);
const envModeSchema = z.enum(["auto", "force-turn", "direct-only"]);
const browserFamilySchema = z.enum(["chrome", "firefox", "safari", "edge", "other"]).optional();
const deviceClassSchema = z.enum(["mobile", "desktop"]).optional();

export const recordWebrtcConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roomId: z.string().uuid().optional(),
        path: pathKindSchema,
        localCandidateType: candidateTypeSchema,
        remoteCandidateType: candidateTypeSchema,
        turnAttempted: z.boolean(),
        turnSucceeded: z.boolean(),
        connectMs: z.number().int().nonnegative().max(600_000).optional(),
        participantCount: z.number().int().min(0).max(20).optional(),
        browserFamily: browserFamilySchema,
        deviceClass: deviceClassSchema,
        envMode: envModeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("webrtc_connection_events")
      .insert({
        user_id: userId,
        room_id: data.roomId ?? null,
        path: data.path,
        local_candidate_type: data.localCandidateType ?? null,
        remote_candidate_type: data.remoteCandidateType ?? null,
        turn_attempted: data.turnAttempted,
        turn_succeeded: data.turnSucceeded,
        connect_ms: data.connectMs ?? null,
        participant_count: data.participantCount ?? null,
        browser_family: data.browserFamily ?? null,
        device_class: data.deviceClass ?? null,
        env_mode: data.envMode,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const recordWebrtcRelayEnd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        bytesSent: z.number().int().nonnegative().max(5_000_000_000).optional(),
        bytesReceived: z.number().int().nonnegative().max(5_000_000_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("webrtc_connection_events")
      .update({
        relay_ended_at: new Date().toISOString(),
        bytes_sent: data.bytesSent ?? null,
        bytes_received: data.bytesReceived ?? null,
      })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// Periodic per-peer quality snapshot. Client aggregates 5 samples (~20s) then
// flushes averaged fields to the existing connection row. Best-effort — never
// fatal to the call. All fields optional so partial samples still land.
// -----------------------------------------------------------------------------
export const recordWebrtcSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        avgRttMs: z.number().int().nonnegative().max(60_000).optional(),
        avgOutboundKbpsVideo: z.number().int().nonnegative().max(100_000).optional(),
        avgOutboundKbpsAudio: z.number().int().nonnegative().max(1_000).optional(),
        avgInboundKbpsVideo: z.number().int().nonnegative().max(100_000).optional(),
        avgInboundKbpsAudio: z.number().int().nonnegative().max(1_000).optional(),
        packetLossPctOut: z.number().nonnegative().max(100).optional(),
        packetLossPctIn: z.number().nonnegative().max(100).optional(),
        jitterMsIn: z.number().int().nonnegative().max(10_000).optional(),
        framesDropped: z.number().int().nonnegative().max(1_000_000_000).optional(),
        outboundWidth: z.number().int().nonnegative().max(8192).optional(),
        outboundHeight: z.number().int().nonnegative().max(8192).optional(),
        outboundFps: z.number().int().nonnegative().max(240).optional(),
        qualityLimitationReason: z.enum(["none", "cpu", "bandwidth", "other"]).optional(),
        iceRestarts: z.number().int().nonnegative().max(1000).optional(),
        reconnectCount: z.number().int().nonnegative().max(1000).optional(),
        healthState: z.enum(["ok", "degraded", "video-off"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    // Only include provided fields so a missing metric doesn't clobber a good one.
    if (data.avgRttMs !== undefined) patch.avg_rtt_ms = data.avgRttMs;
    if (data.avgOutboundKbpsVideo !== undefined) patch.avg_outbound_kbps_video = data.avgOutboundKbpsVideo;
    if (data.avgOutboundKbpsAudio !== undefined) patch.avg_outbound_kbps_audio = data.avgOutboundKbpsAudio;
    if (data.avgInboundKbpsVideo !== undefined) patch.avg_inbound_kbps_video = data.avgInboundKbpsVideo;
    if (data.avgInboundKbpsAudio !== undefined) patch.avg_inbound_kbps_audio = data.avgInboundKbpsAudio;
    if (data.packetLossPctOut !== undefined) patch.packet_loss_pct_out = data.packetLossPctOut;
    if (data.packetLossPctIn !== undefined) patch.packet_loss_pct_in = data.packetLossPctIn;
    if (data.jitterMsIn !== undefined) patch.jitter_ms_in = data.jitterMsIn;
    if (data.framesDropped !== undefined) patch.frames_dropped = data.framesDropped;
    if (data.outboundWidth !== undefined) patch.outbound_width = data.outboundWidth;
    if (data.outboundHeight !== undefined) patch.outbound_height = data.outboundHeight;
    if (data.outboundFps !== undefined) patch.outbound_fps = data.outboundFps;
    if (data.qualityLimitationReason !== undefined) patch.quality_limitation_reason = data.qualityLimitationReason;
    if (data.iceRestarts !== undefined) patch.ice_restarts = data.iceRestarts;
    if (data.reconnectCount !== undefined) patch.reconnect_count = data.reconnectCount;
    if (data.healthState !== undefined) patch.health_state_terminal = data.healthState;
    // snapshot_count is monotonic; use a tiny select-then-update since PostgREST
    // doesn't expose atomic increment. Non-blocking on failure.
    const { data: cur } = await supabase
      .from("webrtc_connection_events")
      .select("snapshot_count")
      .eq("id", data.eventId)
      .maybeSingle();
    patch.snapshot_count = ((cur as { snapshot_count?: number } | null)?.snapshot_count ?? 0) + 1;
    const { error } = await supabase
      .from("webrtc_connection_events")
      .update(patch as never)
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

