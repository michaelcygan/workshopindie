/**
 * One notification delivery service.
 *
 * Notifications used to be hand-written in roughly a dozen modules, each
 * re-implementing some subset of: don't notify yourself, respect the
 * recipient's preferences, skip people who blocked the actor, avoid
 * duplicates, shape the payload. That logic lives here now.
 *
 * The `notifications` table, the bell UI and every existing notification kind
 * are unchanged — this is a change in who writes the row, not what the row is.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** In-app preference columns on `notification_preferences`. */
export type NotificationPreference =
  | "inapp_messages"
  | "inapp_collab_activity"
  | "inapp_workshop_updates"
  | "inapp_follows"
  | "inapp_credits"
  | "inapp_friend_online";

export type NotifyInput = {
  recipientIds: string[];
  /** Who caused it. Null for system-generated notices. */
  actorUserId?: string | null;
  kind: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  /** Preference column that mutes this kind. Omit when it can't be muted. */
  preference?: NotificationPreference;
  /**
   * Collapse repeats of the same (recipient, kind, entity) written inside this
   * many seconds. Defaults to 60; pass 0 to always write.
   */
  dedupeWindowS?: number;
  /** Allow notifying the actor themselves. Off by default. */
  allowSelf?: boolean;
};

/** Deliver one notification to many recipients. Never throws. */
export async function notifyMany(input: NotifyInput): Promise<{ delivered: number }> {
  try {
    const actor = input.actorUserId ?? null;
    let recipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
    if (!input.allowSelf && actor) recipients = recipients.filter((id) => id !== actor);
    if (recipients.length === 0) return { delivered: 0 };

    // Preference opt-out. Missing row means "not opted out".
    if (input.preference) {
      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select(`user_id, ${input.preference}`)
        .in("user_id", recipients);
      const mutedBy = new Set(
        (prefs ?? [])
          .filter((p) => (p as Record<string, unknown>)[input.preference!] === false)
          .map((p) => (p as { user_id: string }).user_id),
      );
      recipients = recipients.filter((id) => !mutedBy.has(id));
      if (recipients.length === 0) return { delivered: 0 };
    }

    // Block filtering, in either direction.
    if (actor) {
      const { data: blocks } = await supabaseAdmin
        .from("user_blocks")
        .select("blocker_user_id, blocked_user_id")
        .or(`blocker_user_id.eq.${actor},blocked_user_id.eq.${actor}`);
      const blockedPairs = new Set(
        (blocks ?? []).flatMap((b) => [b.blocker_user_id as string, b.blocked_user_id as string]),
      );
      blockedPairs.delete(actor);
      recipients = recipients.filter((id) => !blockedPairs.has(id));
      if (recipients.length === 0) return { delivered: 0 };
    }

    // Dedupe: skip recipients who already got this exact notice moments ago.
    const windowS = input.dedupeWindowS ?? 60;
    if (windowS > 0 && input.entityId) {
      const since = new Date(Date.now() - windowS * 1000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("notifications")
        .select("user_id")
        .eq("kind", input.kind)
        .eq("entity_id", input.entityId)
        .gte("created_at", since)
        .in("user_id", recipients);
      const already = new Set((recent ?? []).map((r) => r.user_id as string));
      recipients = recipients.filter((id) => !already.has(id));
      if (recipients.length === 0) return { delivered: 0 };
    }

    const rows = recipients.map((uid) => ({
      user_id: uid,
      kind: input.kind,
      actor_user_id: actor,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      payload: (input.payload ?? {}) as never,
    }));
    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) {
      console.error("[notify] insert failed", { kind: input.kind, message: error.message });
      return { delivered: 0 };
    }
    return { delivered: rows.length };
  } catch (err) {
    console.error("[notify] failed", { kind: input.kind, err });
    return { delivered: 0 };
  }
}

/** Deliver one notification to one recipient. Never throws. */
export async function notify(
  input: Omit<NotifyInput, "recipientIds"> & { recipientId: string },
): Promise<{ delivered: number }> {
  const { recipientId, ...rest } = input;
  return notifyMany({ ...rest, recipientIds: [recipientId] });
}
