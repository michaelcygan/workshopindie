import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CF_BASE = "https://api.cloudflare.com/client/v4";

function cfHeaders() {
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!token) throw new Error("Cloudflare Stream is not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function accountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!id) throw new Error("Cloudflare account is not configured");
  return id;
}

/**
 * Creates a one-time direct-upload URL on Cloudflare Stream.
 * The browser POSTs the video file directly to `uploadURL` (no bandwidth
 * through our worker). Returns the `uid` so we can later poll status.
 */
export const createStreamUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      maxDurationSeconds: z.number().int().min(1).max(3600).default(600),
    }).parse,
  )
  .handler(async ({ data }) => {
    const res = await fetch(
      `${CF_BASE}/accounts/${accountId()}/stream/direct_upload`,
      {
        method: "POST",
        headers: cfHeaders(),
        body: JSON.stringify({
          maxDurationSeconds: data.maxDurationSeconds,
          requireSignedURLs: false,
        }),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string }>;
      result?: { uploadURL: string; uid: string };
    };
    if (!res.ok || !json.success || !json.result) {
      const msg = json.errors?.[0]?.message ?? `Cloudflare error (${res.status})`;
      throw new Error(msg);
    }
    return { uploadURL: json.result.uploadURL, uid: json.result.uid };
  });

/**
 * Polls Cloudflare for the asset's HLS manifest URL and records it in
 * `media_assets` for the calling user. Safe to call repeatedly — uses
 * the unique (provider, provider_uid) index.
 */
export const finalizeStreamUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      uid: z.string().min(1).max(64),
      workId: z.string().uuid().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const res = await fetch(
      `${CF_BASE}/accounts/${accountId()}/stream/${encodeURIComponent(data.uid)}`,
      { method: "GET", headers: cfHeaders() },
    );
    const json = (await res.json()) as {
      success: boolean;
      errors?: Array<{ message: string }>;
      result?: {
        uid: string;
        readyToStream: boolean;
        duration?: number;
        thumbnail?: string;
        playback?: { hls?: string; dash?: string };
        status?: { state?: string };
      };
    };
    if (!res.ok || !json.success || !json.result) {
      const msg = json.errors?.[0]?.message ?? `Cloudflare error (${res.status})`;
      throw new Error(msg);
    }

    const r = json.result;
    const ready = !!r.readyToStream;
    const hls = r.playback?.hls ?? null;

    const { supabase, userId } = context;

    // Upsert by (provider, provider_uid)
    const { data: existing } = await supabase
      .from("media_assets")
      .select("id")
      .eq("provider", "cloudflare_stream")
      .eq("provider_uid", r.uid)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("media_assets")
        .update({
          hls_url: hls,
          thumbnail_url: r.thumbnail ?? null,
          duration_s: r.duration ? Math.round(r.duration) : null,
          status: ready ? "ready" : "pending",
          ready_at: ready ? new Date().toISOString() : null,
          work_id: data.workId ?? null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("media_assets").insert({
        owner_id: userId,
        work_id: data.workId ?? null,
        kind: "video",
        provider: "cloudflare_stream",
        provider_uid: r.uid,
        hls_url: hls,
        thumbnail_url: r.thumbnail ?? null,
        duration_s: r.duration ? Math.round(r.duration) : null,
        status: ready ? "ready" : "pending",
        ready_at: ready ? new Date().toISOString() : null,
      });
    }

    return {
      ready,
      hlsUrl: hls,
      thumbnailUrl: r.thumbnail ?? null,
      durationSeconds: r.duration ?? null,
    };
  });
