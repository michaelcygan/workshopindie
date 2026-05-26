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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ttl = data.ttlSeconds ?? 600;

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

    // Cost-visibility log (best-effort).
    await supabaseAdmin
      .from("turn_credential_grants")
      .insert({
        user_id: userId,
        room_id: data.roomId ?? null,
        ttl_seconds: ttl,
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
