import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BODY_MAX, extractMentions } from "./today-chat.server";

export const postTodayMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        groupId: z.string().uuid(),
        body: z.string().min(1).max(BODY_MAX),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    if (!body) throw new Error("Empty message");

    // Confirm caller is a group member (RLS will also enforce, but fail fast).
    const { data: member } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("Join the group to post here.");

    // App-level moderation (Core rule). DB trigger stays as last line of defense.
    try {
      const { moderateOrThrow } = await import("@/lib/moderation/service.server");
      await moderateOrThrow({
        userId,
        surface: "group.today",
        subjectId: data.groupId,
        text: body,
        spam: { maxLinks: 4, maxRepeatChars: 25 },
      });
    } catch (err) {
      console.error("[today-post] moderation", err);
      throw err;
    }

    // expires_at is populated by the BEFORE INSERT trigger tg_gtp_set_expiry.
    const { data: inserted, error: insertError } = await supabase
      .from("group_today_posts")
      .insert({
        group_id: data.groupId,
        author_id: userId,
        body,
      } as never)
      .select("id,created_at,expires_at")
      .single();
    if (insertError) {
      console.error("[today-post] insert failed", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId,
        groupId: data.groupId,
      });
      // Surface the underlying trigger message (moderation_block, rate limit, RLS)
      // to the client so the toast is actionable instead of generic.
      if (insertError.message?.includes("moderation_block")) {
        throw new Error("Your message was blocked by moderation.");
      }
      if (insertError.message?.includes("Slow down")) {
        throw new Error(insertError.message);
      }
      if (insertError.code === "42501") {
        throw new Error("You don't have permission to post here.");
      }
      throw new Error(insertError.message || "Could not post message.");
    }

    const postId = (inserted as { id: string }).id;

    // Mentions → notifications. Best-effort; failures here must not roll back the post.
    const usernames = extractMentions(body);
    if (usernames.length > 0) {
      try {
        const { data: groupRow } = await supabase
          .from("groups")
          .select("slug,name")
          .eq("id", data.groupId)
          .maybeSingle();
        const { data: targets } = await supabase
          .from("profiles")
          .select("id,username")
          .in("username", usernames);

        const targetIds = (targets ?? [])
          .map((t) => t.id as string)
          .filter((id) => id !== userId);

        if (targetIds.length > 0) {
          // Restrict to current group members.
          const { data: members } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", data.groupId)
            .in("user_id", targetIds);
          const allowed = new Set((members ?? []).map((m) => m.user_id as string));

          const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body;
          const payload = {
            group_slug: groupRow?.slug ?? null,
            group_name: groupRow?.name ?? null,
            snippet,
          };
          const rows = targetIds
            .filter((id) => allowed.has(id))
            .map((id) => ({
              user_id: id,
              actor_user_id: userId,
              kind: "today_mention",
              entity_type: "group_today_post",
              entity_id: postId,
              payload,
            }));
          if (rows.length > 0) {
            await supabase.from("notifications").insert(rows as never);
          }
        }
      } catch {
        // Swallow — message already posted.
      }
    }

    return { ok: true, id: postId };
  });
