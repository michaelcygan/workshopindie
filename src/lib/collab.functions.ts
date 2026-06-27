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

    // 5. Insert guest app + claim token.
    const userAgent = getRequestHeader("user-agent")?.slice(0, 255) ?? null;
    const ig = data.instagramHandle ? data.instagramHandle.replace(/^@/, "") : null;
    const claimToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insertErr } = await supabaseAdmin
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
        claim_token: claimToken,
        claim_token_expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // 6. Get collab title and notify the post owner so they see activity immediately.
    const { data: postFull } = await supabaseAdmin
      .from("collab_posts")
      .select("title,slug")
      .eq("id", data.collabPostId)
      .maybeSingle();
    await supabaseAdmin.from("notifications").insert({
      user_id: post.user_id,
      kind: "collab_application",
      actor_user_id: null,
      entity_type: "collab_post",
      entity_id: data.collabPostId,
      payload: {
        actor_name: data.name,
        is_guest: true,
        collab_title: postFull?.title ?? "your collab",
        collab_slug: postFull?.slug ?? null,
        preview: data.message.slice(0, 140),
      },
    });

    return { ok: true as const, claimToken, applicationId: inserted.id };
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

    const [eventsRes, guestsRes] = await Promise.all([
      supabase
        .from("collab_contact_events")
        .select("id,sent_at,message_preview,collab_role_id,sender_user_id")
        .eq("collab_post_id", data.collabPostId)
        .order("sent_at", { ascending: false }),
      supabase
        .from("collab_guest_applications")
        .select(
          "id,created_at,name,email,phone,message,portfolio_url,reel_url,instagram_handle,status,collab_role_id,matched_user_id,claim_token,claim_token_expires_at",
        )
        .eq("collab_post_id", data.collabPostId)
        .order("created_at", { ascending: false }),
    ]);

    const events = eventsRes.data ?? [];
    const guestRows = (guestsRes.data ?? []).filter((g) => !g.matched_user_id);

    // Hydrate sender profiles in one batched query.
    const senderIds = Array.from(new Set(events.map((e) => e.sender_user_id).filter(Boolean)));
    let profileMap: Record<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null; headline: string | null; instagram_handle: string | null }> = {};
    if (senderIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,headline,instagram_handle")
        .in("id", senderIds);
      profileMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }

    // Resolve conversation IDs for each member-applicant so the owner can Reply in one tap.
    const convoMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id,user_a,user_b")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`);
      for (const c of convos ?? []) {
        const other = c.user_a === userId ? c.user_b : c.user_a;
        if (senderIds.includes(other)) convoMap[other] = c.id;
      }
    }


    const members = events.map((e) => ({
      id: e.id,
      sent_at: e.sent_at,
      message_preview: e.message_preview,
      collab_role_id: e.collab_role_id,
      sender: profileMap[e.sender_user_id] ?? null,
      conversation_id: convoMap[e.sender_user_id] ?? null,
    }));

    return { members, guests: guestRows };
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

// Helper: ensure allowance row exists, create+seed conversation if new, insert opening message.
// Uses supabaseAdmin where RLS would otherwise reject (allowance row, notifications).
async function openCollabDmThread(args: {
  collabPostId: string;
  ownerUserId: string;
  applicantUserId: string;
  message: string;
}): Promise<{ conversationId: string }> {
  const { collabPostId, ownerUserId, applicantUserId, message } = args;
  if (ownerUserId === applicantUserId) throw new Error("Cannot apply to your own collab.");

  // 1. Block guard
  const { data: blocked } = await supabaseAdmin.rpc("is_blocked_pair", {
    _a: ownerUserId,
    _b: applicantUserId,
  });
  if (blocked === true) throw new Error("This conversation is not available.");

  // 2. Upsert allowance (idempotent)
  await supabaseAdmin
    .from("collab_dm_allowances")
    .upsert(
      { collab_post_id: collabPostId, owner_user_id: ownerUserId, applicant_user_id: applicantUserId },
      { onConflict: "collab_post_id,owner_user_id,applicant_user_id" },
    );

  // 3. Find or create conversation (ordered pair). Set collab context only on creation.
  const [a, b] = applicantUserId < ownerUserId ? [applicantUserId, ownerUserId] : [ownerUserId, applicantUserId];
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  let conversationId: string;
  if (existing?.id) {
    conversationId = existing.id;
  } else {
    const { data: created, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({ user_a: a, user_b: b, context_collab_post_id: collabPostId })
      .select("id")
      .single();
    if (convErr) throw new Error(convErr.message);
    conversationId = created.id;
  }

  // 4. Insert opening message from applicant.
  const { error: msgErr } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: applicantUserId, body: message });
  if (msgErr) throw new Error(msgErr.message);

  return { conversationId };
}

const applySchema = z.object({
  collabPostId: z.string().uuid(),
  collabRoleId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(10).max(2000),
});

export const applyToCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const hit = findHateSlur(data.message);
    if (hit) throw new Error("Your message contains language that isn't allowed. Please revise and try again.");

    const { data: post, error: postErr } = await supabaseAdmin
      .from("collab_posts")
      .select("id,status,user_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("This collab post no longer exists.");
    if (post.status !== "open") throw new Error("This collab is no longer accepting applications.");
    if (post.user_id === userId) throw new Error("You can't apply to your own collab.");

    // Log contact event (also feeds the applicants panel).
    await supabaseAdmin.from("collab_contact_events").insert({
      collab_post_id: data.collabPostId,
      collab_role_id: data.collabRoleId ?? null,
      sender_user_id: userId,
      message_preview: data.message.slice(0, 280),
    });

    const { conversationId } = await openCollabDmThread({
      collabPostId: data.collabPostId,
      ownerUserId: post.user_id,
      applicantUserId: userId,
      message: data.message,
    });

    return { ok: true as const, conversationId };
  });

export const claimGuestApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: app, error: appErr } = await supabaseAdmin
      .from("collab_guest_applications")
      .select("id,collab_post_id,collab_role_id,message,matched_user_id,claim_token_expires_at")
      .eq("claim_token", data.token)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("This claim link isn't valid anymore.");
    if (app.claim_token_expires_at && new Date(app.claim_token_expires_at).getTime() < Date.now()) {
      throw new Error("This claim link has expired. Ask the host to resend or reapply.");
    }

    const { data: post } = await supabaseAdmin
      .from("collab_posts")
      .select("id,user_id")
      .eq("id", app.collab_post_id)
      .maybeSingle();
    if (!post) throw new Error("This collab no longer exists.");
    if (post.user_id === userId) throw new Error("You can't claim an application on your own collab.");

    // Mark claimed + clear token. The on-signup backfill also fires this for guest rows whose
    // email matches the new user; this branch covers the explicit /collab/claim/$token flow.
    if (!app.matched_user_id) {
      await supabaseAdmin
        .from("collab_guest_applications")
        .update({ matched_user_id: userId, matched_at: new Date().toISOString(), claim_token: null, claim_token_expires_at: null })
        .eq("id", app.id);

      // Mirror into native contact_events feed (the auto-backfill trigger only fires on
      // brand-new signups; this handles the case where an already-signed-in user claims).
      await supabaseAdmin.from("collab_contact_events").insert({
        collab_post_id: app.collab_post_id,
        collab_role_id: app.collab_role_id,
        sender_user_id: userId,
        message_preview: app.message.slice(0, 280),
      });
    }

    const { conversationId } = await openCollabDmThread({
      collabPostId: app.collab_post_id,
      ownerUserId: post.user_id,
      applicantUserId: userId,
      message: app.message,
    });

    return { ok: true as const, conversationId };
  });

// ──────────────────────────────────────────────────────────────────────
// Activity meter (owner-only) + public applicant count
// ──────────────────────────────────────────────────────────────────────

export const getCollabActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post } = await supabase
      .from("collab_posts")
      .select("id,user_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (!post || post.user_id !== userId) {
      throw new Error("Only the post owner can view activity.");
    }
    const [memberRes, guestRes, shareRes] = await Promise.all([
      supabaseAdmin
        .from("collab_contact_events")
        .select("collab_role_id")
        .eq("collab_post_id", data.collabPostId),
      supabaseAdmin
        .from("collab_guest_applications")
        .select("collab_role_id")
        .eq("collab_post_id", data.collabPostId),
      supabaseAdmin
        .from("collab_share_events")
        .select("id", { count: "exact", head: true })
        .eq("collab_post_id", data.collabPostId),
    ]);
    const perRole: Record<string, number> = {};
    let total = 0;
    for (const row of [...(memberRes.data ?? []), ...(guestRes.data ?? [])]) {
      total++;
      const rid = (row as { collab_role_id: string | null }).collab_role_id;
      if (rid) perRole[rid] = (perRole[rid] ?? 0) + 1;
    }
    return {
      applicants: total,
      shares: shareRes.count ?? 0,
      perRole,
    };
  });

export const getCollabPublicCounts = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const [memberRes, guestRes] = await Promise.all([
      supabaseAdmin
        .from("collab_contact_events")
        .select("id", { count: "exact", head: true })
        .eq("collab_post_id", data.collabPostId),
      supabaseAdmin
        .from("collab_guest_applications")
        .select("id", { count: "exact", head: true })
        .eq("collab_post_id", data.collabPostId),
    ]);
    return { applicants: (memberRes.count ?? 0) + (guestRes.count ?? 0) };
  });

// ──────────────────────────────────────────────────────────────────────
// Owner edit + member self-service (leave / re-consent on scope change)
// ──────────────────────────────────────────────────────────────────────

const roleDraftSchema = z.object({
  role_name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(20),
  description: z.string().trim().max(1000).nullable().optional(),
});

const updateSchema = z.object({
  collabPostId: z.string().uuid(),
  patch: z.object({
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    timeline_text: z.string().trim().max(120).nullable().optional(),
    timeline_mode: z.enum(["flexible", "by_date", "between"]).optional(),
    starts_on: z.string().nullable().optional(),
    ends_on: z.string().nullable().optional(),
    location_mode: z.enum(["online", "in_person", "hybrid"]).optional(),
    city_id: z.string().uuid().nullable().optional(),
    also_cities: z.array(z.string().uuid()).max(4).optional(),
    compensation_type: z.enum(["paid", "unpaid", "credit", "negotiable", "unspecified"]).optional(),
    rights_arrangement: z
      .enum(["owner_retains", "equal_split", "creative_commons", "decide_later"])
      .optional(),
    status: z.enum(["draft", "open"]).optional(),
    roles: z.array(roleDraftSchema).max(20).optional(),
  }),
});

// Fields whose change bumps the consent version. Cosmetic edits (typos) don't.
const SCOPE_KEYS = [
  "title",
  "description",
  "timeline_mode",
  "starts_on",
  "ends_on",
  "location_mode",
  "city_id",
  "compensation_type",
  "rights_arrangement",
] as const;

export const updateCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error: postErr } = await supabase
      .from("collab_posts")
      .select("id,user_id,terms_version,title,description,timeline_mode,starts_on,ends_on,location_mode,city_id,compensation_type,rights_arrangement,status")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("This collab no longer exists.");
    if (post.user_id !== userId) throw new Error("Only the owner can edit this collab.");

    const patch = data.patch;
    if (patch.title) {
      const hit = findHateSlur(patch.title);
      if (hit) throw new Error("Title contains language that isn't allowed.");
    }
    if (patch.description) {
      const hit = findHateSlur(patch.description);
      if (hit) throw new Error("Description contains language that isn't allowed.");
    }

    // Detect a scope change.
    let scopeChanged = false;
    for (const k of SCOPE_KEYS) {
      if (k in patch && (patch as Record<string, unknown>)[k] !== (post as Record<string, unknown>)[k]) {
        scopeChanged = true;
        break;
      }
    }

    // Build the row update.
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === "roles") continue;
      if (v === undefined) continue;
      row[k] = v;
    }

    // Compare roles too — any difference is a scope change.
    let nextRoles: Array<z.infer<typeof roleDraftSchema>> | null = null;
    if (patch.roles) {
      const { data: existingRoles } = await supabaseAdmin
        .from("collab_roles")
        .select("role_name,quantity,description")
        .eq("collab_post_id", data.collabPostId)
        .order("sort_order", { ascending: true });
      const norm = (r: { role_name: string; quantity: number; description: string | null }) =>
        `${r.role_name.trim().toLowerCase()}|${r.quantity}|${(r.description ?? "").trim()}`;
      const a = (existingRoles ?? []).map(norm).join("§");
      const b = patch.roles
        .map((r) => norm({ role_name: r.role_name, quantity: r.quantity, description: r.description ?? null }))
        .join("§");
      if (a !== b) {
        scopeChanged = true;
        nextRoles = patch.roles;
      }
    }

    if (scopeChanged) {
      row.terms_version = (post.terms_version ?? 1) + 1;
    }

    if (Object.keys(row).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("collab_posts")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(row as any)
        .eq("id", data.collabPostId);
      if (updErr) throw new Error(updErr.message);
    }

    if (nextRoles) {
      await supabaseAdmin.from("collab_roles").delete().eq("collab_post_id", data.collabPostId);
      await supabaseAdmin.from("collab_roles").insert(
        nextRoles.map((r, i) => ({
          collab_post_id: data.collabPostId,
          role_name: r.role_name.trim(),
          quantity: r.quantity,
          description: r.description?.trim() || null,
          sort_order: i,
        })),
      );
    }

    // Notify accepted collaborators that scope changed.
    if (scopeChanged) {
      const { data: invites } = await supabaseAdmin
        .from("collab_invites")
        .select("invitee_user_id")
        .eq("collab_post_id", data.collabPostId)
        .eq("status", "accepted");
      if (invites && invites.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          invites.map((i) => ({
            user_id: i.invitee_user_id,
            kind: "collab_scope_changed",
            actor_user_id: userId,
            entity_type: "collab_post",
            entity_id: data.collabPostId,
            payload: { collab_title: post.title },
          })),
        );
      }
    }

    return { ok: true as const, scopeChanged, termsVersion: row.terms_version ?? post.terms_version };
  });

export const leaveCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post } = await supabase
      .from("collab_posts")
      .select("id,user_id,title")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (!post) throw new Error("This collab no longer exists.");
    if (post.user_id === userId) throw new Error("Owners can't leave their own collab — close it instead.");

    const { data: rows, error } = await supabase
      .from("collab_invites")
      .update({ status: "left", responded_at: new Date().toISOString() })
      .eq("collab_post_id", data.collabPostId)
      .eq("invitee_user_id", userId)
      .eq("status", "accepted")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("You're not on this collab.");

    await supabaseAdmin.from("notifications").insert({
      user_id: post.user_id,
      kind: "collab_member_left",
      actor_user_id: userId,
      entity_type: "collab_post",
      entity_id: data.collabPostId,
      payload: { collab_title: post.title },
    });
    return { ok: true as const };
  });

export const acceptCollabChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post } = await supabase
      .from("collab_posts")
      .select("terms_version")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (!post) throw new Error("This collab no longer exists.");

    const { error } = await supabase
      .from("collab_invites")
      .update({ accepted_terms_version: post.terms_version })
      .eq("collab_post_id", data.collabPostId)
      .eq("invitee_user_id", userId)
      .eq("status", "accepted");
    if (error) throw new Error(error.message);
    return { ok: true as const, termsVersion: post.terms_version };
  });

// Returns the viewer's membership state for a collab — used to show
// the Leave button and the re-consent banner.
export const getMyCollabMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [postRes, inviteRes] = await Promise.all([
      supabase.from("collab_posts").select("terms_version").eq("id", data.collabPostId).maybeSingle(),
      supabase
        .from("collab_invites")
        .select("id,status,accepted_terms_version")
        .eq("collab_post_id", data.collabPostId)
        .eq("invitee_user_id", userId)
        .eq("status", "accepted")
        .maybeSingle(),
    ]);
    if (!postRes.data || !inviteRes.data) {
      return { isMember: false as const };
    }
    const termsVersion = postRes.data.terms_version ?? 1;
    const accepted = inviteRes.data.accepted_terms_version ?? 1;
    return {
      isMember: true as const,
      needsReconsent: accepted < termsVersion,
      termsVersion,
    };
  });

