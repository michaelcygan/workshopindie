import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findHateSlur } from "./profanity.server";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Must be a valid URL");

const guestSchema = z.object({
  collabPostId: z.string().uuid(),
  collabRoleId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(1000),
  portfolioUrl: httpsUrl.optional().or(z.literal("")),
  reelUrl: httpsUrl.optional().or(z.literal("")),
  instagramHandle: z
    .string()
    .trim()
    .max(40)
    .regex(/^@?[a-zA-Z0-9_.]{1,30}$/, "Invalid Instagram handle")
    .optional()
    .or(z.literal("")),
});

function clientIpHash(): string | null {
  const raw =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!raw) return null;
  // Salt with the UTC date so we can rate-limit per day without storing raw IPs.
  const salt = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${raw}::${salt}`).digest("hex");
}

export const submitGuestApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => guestSchema.parse(input))
  .handler(async ({ data }) => {
    // 1. Hate-speech filter (multilingual). Runs on every free-text field.
    const fields = [data.name, data.message, data.instagramHandle ?? ""];
    for (const f of fields) {
      const hit = findHateSlur(f);
      if (hit) {
        // Don't echo the matched word back — generic message.
        throw new Error("Your message contains language that isn't allowed. Please revise and try again.");
      }
    }

    // 2. Confirm post is real and open.
    const { data: post, error: postErr } = await supabaseAdmin
      .from("collab_posts")
      .select("id,status,user_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("This collab post no longer exists.");
    if (post.status !== "open") throw new Error("This collab post is no longer accepting applications.");

    // 3. Rate-limit by hashed IP — max 5 / hour, 20 / day across the platform.
    const ipHash = clientIpHash();
    if (ipHash) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("collab_guest_applications")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= 5) {
        throw new Error("You've sent a few applications recently — please wait a bit before sending more.");
      }
    }

    // 4. Per-post duplicate guard (same email within last 24h).
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dupe } = await supabaseAdmin
      .from("collab_guest_applications")
      .select("id")
      .eq("collab_post_id", data.collabPostId)
      .ilike("email", data.email)
      .gte("created_at", dayAgo)
      .maybeSingle();
    if (dupe) {
      throw new Error("You've already applied to this post — give the host a day to reply.");
    }

    // 5. Insert.
    const userAgent = getRequestHeader("user-agent")?.slice(0, 255) ?? null;
    const ig = data.instagramHandle ? data.instagramHandle.replace(/^@/, "") : null;

    const { error: insertErr } = await supabaseAdmin
      .from("collab_guest_applications")
      .insert({
        collab_post_id: data.collabPostId,
        collab_role_id: data.collabRoleId ?? null,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
        portfolio_url: data.portfolioUrl || null,
        reel_url: data.reelUrl || null,
        instagram_handle: ig,
        ip_hash: ipHash,
        user_agent: userAgent,
      });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true as const };
  });

const shareSchema = z.object({
  collabPostId: z.string().uuid(),
  channel: z.enum(["copy", "native", "story_image", "caption", "other"]),
});

export const logShareEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => shareSchema.parse(input))
  .handler(async ({ data }) => {
    // Best-effort, never throw to the caller.
    await supabaseAdmin
      .from("collab_share_events")
      .insert({ collab_post_id: data.collabPostId, channel: data.channel })
      .then(() => null, () => null);
    return { ok: true as const };
  });

// Combined applicant list for the post owner: members + guests, newest first.
export const listApplicants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS will reject if userId doesn't own the post, but we double-check first
    // so we can return a clean error instead of a permission-denied surprise.
    const { data: post } = await supabase
      .from("collab_posts")
      .select("id,user_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (!post || post.user_id !== userId) {
      throw new Error("Only the post owner can view applicants.");
    }

    const [members, guests] = await Promise.all([
      supabase
        .from("collab_contact_events")
        .select(
          "id,sent_at,message_preview,collab_role_id," +
            "sender:profiles!collab_contact_events_sender_user_id_fkey(id,username,display_name,avatar_url,headline,instagram_handle)",
        )
        .eq("collab_post_id", data.collabPostId)
        .order("sent_at", { ascending: false }),
      supabase
        .from("collab_guest_applications")
        .select(
          "id,created_at,name,email,phone,message,portfolio_url,reel_url,instagram_handle,status,collab_role_id,matched_user_id",
        )
        .eq("collab_post_id", data.collabPostId)
        .order("created_at", { ascending: false }),
    ]);

    // Hide guest rows that have been mirrored into the member feed via signup.
    const guestRows = (guests.data ?? []).filter((g) => !g.matched_user_id);

    return {
      members: members.data ?? [],
      guests: guestRows,
    };
  });

export const updateGuestApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "contacted", "spam", "hidden"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS already restricts updates to the post owner.
    const { error } = await context.supabase
      .from("collab_guest_applications")
      .update({
        status: data.status,
        contacted_at: data.status === "contacted" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
