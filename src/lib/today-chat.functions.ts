import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BODY_MAX = 500;
const MENTION_RE = /(?:^|\s)@([a-zA-Z0-9_]{2,30})/g;
const MENTION_CAP = 10;

function extractMentions(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) {
    out.add(m[1].toLowerCase());
    if (out.size >= MENTION_CAP) break;
  }
  return Array.from(out);
}

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

    const { data: inserted, error: insertError } = await supabase
      .from("group_today_posts")
      .insert({ group_id: data.groupId, author_id: userId, body } as never)
      .select("id,created_at,expires_at")
      .single();
    if (insertError) throw new Error(insertError.message);

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
