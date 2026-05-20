import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuidSchema = z.string().uuid();

function pairOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const checkCanDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string }) => ({ otherUserId: uuidSchema.parse(d.otherUserId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("can_dm", { _a: userId, _b: data.otherUserId });
    if (error) throw new Error(error.message);
    return { canDm: Boolean(rows) };
  });

export const openOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string }) => ({ otherUserId: uuidSchema.parse(d.otherUserId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.otherUserId) throw new Error("Cannot message yourself");

    const [a, b] = pairOrder(userId, data.otherUserId);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();

    if (existing?.id) return { conversationId: existing.id };

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_a: a, user_b: b })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { conversationId: created.id };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; body: string }) => ({
    conversationId: uuidSchema.parse(d.conversationId),
    body: z.string().trim().min(1).max(2000).parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate limit: 30 messages / 60s per user
    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "dm_send",
      _key: userId,
      _window_s: 60,
      _max: 30,
    });
    if (ok === false) throw new Error("You're sending messages too fast. Slow down a sec.");

    const { data: msg, error } = await supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, sender_id: userId, body: data.body })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: msg.id, createdAt: msg.created_at };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => ({ conversationId: uuidSchema.parse(d.conversationId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .neq("sender_id", userId)
      .is("read_at", null);
    return { ok: true };
  });
