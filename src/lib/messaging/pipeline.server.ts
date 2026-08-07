/**
 * One messaging policy layer.
 *
 * Every surface where a person can type a message runs the same ordered
 * gauntlet before anything is persisted:
 *
 *   authorize -> normalize -> validate -> rate limit -> block check
 *     -> moderate -> persist (per-surface adapter) -> parse references -> notify
 *
 * Surfaces keep their own tables and their own adapter; only the rules
 * converge. Per-surface differences (length caps, throttles, link rules) are
 * declared as data in `./policies`, not re-decided in each handler.
 *
 * Database moderation triggers stay in place as the last line of defence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DomainError } from "@/lib/errors";
import { findBlockedUrl } from "@/lib/moderation/url-blocklist";
import { MESSAGE_POLICIES, type MessageSurface } from "./policies";
import { extractMentions } from "@/lib/today-chat.server";

type Client = SupabaseClient<Database>;

export type MessageContext = {
  supabase: Client;
  userId: string;
  /** Room, conversation, group or collab id — whatever the surface is scoped to. */
  subjectId: string;
};

/* ─── Shared steps ──────────────────────────────────────────────────── */

function normalize(body: string): string {
  // Collapse Windows newlines, trim trailing whitespace per line, cap blank
  // runs at two, and trim the whole thing. Same text everyone already saw.
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Runs everything that happens before persistence and returns the body to
 * store. Throws a `DomainError` whose message is the string the surface
 * already showed for that situation.
 */
export async function runMessagePolicy(
  surface: MessageSurface,
  ctx: MessageContext,
  rawBody: string,
): Promise<string> {
  const policy = MESSAGE_POLICIES[surface];
  const body = normalize(rawBody);

  if (!body) throw new DomainError("INVALID_INPUT", "Empty message");
  if (body.length > policy.maxLength) {
    throw new DomainError("INVALID_INPUT", "That message is too long.");
  }

  if (policy.rateLimit) {
    const { data: ok } = await ctx.supabase.rpc("check_and_bump", {
      _action: policy.rateLimit.action,
      _key: ctx.userId,
      _window_s: policy.rateLimit.windowS,
      _max: policy.rateLimit.max,
    });
    if (ok === false) {
      throw new DomainError(
        "RATE_LIMITED",
        "You're sending messages too fast. Slow down a sec.",
      );
    }
  }

  if (policy.blockedLinks.enabled && findBlockedUrl(body)) {
    throw new DomainError("MODERATION_BLOCKED", policy.blockedLinks.message);
  }

  if (policy.moderation) {
    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    await moderateOrThrow({
      userId: ctx.userId,
      surface: policy.moderation.surface,
      subjectId: ctx.subjectId,
      text: body,
      ...(policy.moderation.spam ? { spam: policy.moderation.spam } : {}),
    });
  }

  return body;
}

/** Translate a Postgres write failure into the message the surface used to show. */
function persistError(error: { message?: string; code?: string }): DomainError {
  const message = error.message ?? "";
  if (message.includes("moderation_block")) {
    return new DomainError("MODERATION_BLOCKED", "Your message was blocked by moderation.");
  }
  if (message.includes("Slow down")) return new DomainError("RATE_LIMITED", message);
  if (error.code === "42501") {
    return new DomainError("FORBIDDEN", "You don't have permission to post here.");
  }
  return new DomainError("CONFLICT", message || "Could not post message.");
}

/* ─── Surface adapters ──────────────────────────────────────────────── */

/** Direct message → `messages`. */
export async function sendDirectMessage(
  ctx: MessageContext,
  rawBody: string,
): Promise<{ id: string; createdAt: string }> {
  const body = await runMessagePolicy("dm", ctx, rawBody);
  const { data, error } = await ctx.supabase
    .from("messages")
    .insert({ conversation_id: ctx.subjectId, sender_id: ctx.userId, body })
    .select("id, created_at")
    .single();
  if (error || !data) throw persistError(error ?? {});
  return { id: data.id as string, createdAt: data.created_at as string };
}

/** Live room chat → `instant_messages`. */
export async function sendRoomMessage(
  ctx: MessageContext,
  rawBody: string,
  mentionIds: string[] = [],
): Promise<{ messageId: string }> {
  const body = await runMessagePolicy("room", ctx, rawBody);
  const mentions = Array.from(new Set(mentionIds)).filter((id) => id !== ctx.userId);

  // Chat-only participants (and expired presence rows) need a presence row for
  // the RLS WITH CHECK on instant_messages to pass.
  await ctx.supabase
    .from("instant_presence")
    .upsert(
      { room_id: ctx.subjectId, user_id: ctx.userId, last_seen_at: new Date().toISOString() } as never,
      { onConflict: "room_id,user_id" },
    );

  const { data, error } = await ctx.supabase
    .from("instant_messages")
    .insert({ room_id: ctx.subjectId, user_id: ctx.userId, body, mentions } as never)
    .select("id")
    .single();
  if (error || !data) throw persistError(error ?? {});
  const messageId = (data as { id: string }).id;

  if (mentions.length > 0) {
    await notifyRoomMentions(ctx, messageId, body, mentions);
  }
  return { messageId };
}

/** Group Today post → `group_today_posts`. */
export async function sendTodayMessage(
  ctx: MessageContext,
  rawBody: string,
): Promise<{ id: string }> {
  // Fail fast with a human message; RLS enforces the same rule.
  const { data: member } = await ctx.supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", ctx.subjectId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!member) throw new DomainError("FORBIDDEN", "Join the group to post here.");

  const body = await runMessagePolicy("today", ctx, rawBody);

  const { data, error } = await ctx.supabase
    .from("group_today_posts")
    .insert({ group_id: ctx.subjectId, author_id: ctx.userId, body } as never)
    .select("id,created_at,expires_at")
    .single();
  if (error || !data) throw persistError(error ?? {});
  const id = (data as { id: string }).id;

  await notifyTodayMentions(ctx, id, body);
  return { id };
}

/** Collab workspace message → `collab_messages`. */
export async function sendCollabMessage(ctx: MessageContext, rawBody: string) {
  const body = await runMessagePolicy("collab", ctx, rawBody);
  const { data, error } = await ctx.supabase
    .from("collab_messages")
    .insert({ collab_post_id: ctx.subjectId, author_id: ctx.userId, body })
    .select("id,collab_post_id,author_id,body,created_at")
    .single();
  if (error || !data) throw persistError(error ?? {});
  return data;
}

/* ─── Reference parsing + notifications ─────────────────────────────── */

async function notifyRoomMentions(
  ctx: MessageContext,
  messageId: string,
  body: string,
  mentions: string[],
) {
  // Best-effort: a notification failure must never undo a sent message.
  try {
    const { notifyMany } = await import("@/lib/notifications/deliver.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: actorProfile }, { data: room }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name, username").eq("id", ctx.userId).maybeSingle(),
      supabaseAdmin.from("instant_rooms").select("title, medium").eq("id", ctx.subjectId).maybeSingle(),
    ]);
    await notifyMany({
      recipientIds: mentions,
      actorUserId: ctx.userId,
      kind: "chat_mention",
      entityType: "instant_room",
      entityId: ctx.subjectId,
      preference: "inapp_workshop_updates",
      payload: {
        actor_name:
          (actorProfile as { display_name?: string; username?: string } | null)?.display_name ||
          (actorProfile as { username?: string } | null)?.username ||
          "Someone",
        actor_username: (actorProfile as { username?: string } | null)?.username ?? null,
        room_id: ctx.subjectId,
        message_id: messageId,
        title: (room as { title?: string } | null)?.title ?? "Workshop",
        medium: (room as { medium?: string } | null)?.medium ?? null,
        preview: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      },
    });
  } catch {
    // swallow — message is already sent
  }
}

async function notifyTodayMentions(ctx: MessageContext, postId: string, body: string) {
  const usernames = extractMentions(body);
  if (usernames.length === 0) return;
  try {
    const { notifyMany } = await import("@/lib/notifications/deliver.server");
    const [{ data: groupRow }, { data: targets }] = await Promise.all([
      ctx.supabase.from("groups").select("slug,name").eq("id", ctx.subjectId).maybeSingle(),
      ctx.supabase.from("profiles").select("id,username").in("username", usernames),
    ]);
    const targetIds = (targets ?? []).map((t) => t.id as string).filter((id) => id !== ctx.userId);
    if (targetIds.length === 0) return;

    // Only people who are actually in the group get pinged.
    const { data: members } = await ctx.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", ctx.subjectId)
      .in("user_id", targetIds);
    const allowed = new Set((members ?? []).map((m) => m.user_id as string));

    await notifyMany({
      recipientIds: targetIds.filter((id) => allowed.has(id)),
      actorUserId: ctx.userId,
      kind: "today_mention",
      entityType: "group_today_post",
      entityId: postId,
      payload: {
        group_slug: groupRow?.slug ?? null,
        group_name: groupRow?.name ?? null,
        snippet: body.length > 140 ? `${body.slice(0, 137)}…` : body,
      },
    });
  } catch {
    // swallow — post is already up
  }
}
