import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Send a chat message to a live room. Accepts optional `mentions` (user ids)
 * which are stored on the message and converted into `chat_mention`
 * notifications for each recipient (skipping self and anyone opted out).
 *
 * RLS on `instant_messages` enforces that the caller is actually present in
 * (or a workshop member of) the room, so this server fn doesn't re-check.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; body: string; mentions?: string[] }) =>
    z
      .object({
        roomId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
        mentions: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const mentions = Array.from(new Set(data.mentions ?? [])).filter((id) => id !== userId);

    const { data: inserted, error } = await supabase
      .from("instant_messages")
      .insert({
        room_id: data.roomId,
        user_id: userId,
        body: data.body,
        mentions,
      } as any)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Couldn't send message");

    if (mentions.length > 0) {
      // Mentions are best-effort — never block send if notification side fails.
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: actorProfile }, { data: room }, { data: prefs }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("display_name, username")
            .eq("id", userId)
            .maybeSingle(),
          supabaseAdmin
            .from("instant_rooms")
            .select("title, medium")
            .eq("id", data.roomId)
            .maybeSingle(),
          supabaseAdmin
            .from("notification_preferences")
            .select("user_id, inapp_workshop_updates")
            .in("user_id", mentions),
        ]);
        const optedOut = new Set(
          (prefs ?? [])
            .filter((p: any) => p.inapp_workshop_updates === false)
            .map((p: any) => p.user_id as string),
        );
        const recipients = mentions.filter((id) => !optedOut.has(id));
        if (recipients.length > 0) {
          const actorName =
            (actorProfile as any)?.display_name || (actorProfile as any)?.username || "Someone";
          const actorUsername = (actorProfile as any)?.username ?? null;
          const snippet = data.body.length > 140 ? `${data.body.slice(0, 140)}…` : data.body;
          const rows = recipients.map((uid) => ({
            user_id: uid,
            kind: "chat_mention",
            actor_user_id: userId,
            entity_type: "instant_room",
            entity_id: data.roomId,
            payload: {
              actor_name: actorName,
              actor_username: actorUsername,
              room_id: data.roomId,
              message_id: inserted.id,
              title: (room as any)?.title ?? "Workshop",
              medium: (room as any)?.medium ?? null,
              preview: snippet,
            },
          }));
          await supabaseAdmin.from("notifications").insert(rows);
        }
      } catch {
        // best-effort
      }
    }

    return { messageId: inserted.id as string };
  });
