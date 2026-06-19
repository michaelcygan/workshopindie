import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PREF_KEYS = [
  "email_messages",
  "email_collab_activity",
  "email_workshop_updates",
  "email_follows",
  "email_credits",
  "email_friend_online",
  "email_product_news",
  "inapp_messages",
  "inapp_collab_activity",
  "inapp_workshop_updates",
  "inapp_follows",
  "inapp_credits",
  "inapp_friend_online",
] as const;

export type NotifPrefKey = (typeof PREF_KEYS)[number];

export type NotifPrefs = Record<NotifPrefKey, boolean>;

const DEFAULTS: NotifPrefs = {
  email_messages: true,
  email_collab_activity: true,
  email_workshop_updates: true,
  email_follows: true,
  email_credits: true,
  email_friend_online: false,
  email_product_news: false,
  inapp_messages: true,
  inapp_collab_activity: true,
  inapp_workshop_updates: true,
  inapp_follows: true,
  inapp_credits: true,
  inapp_friend_online: false,
};

export const getMyNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotifPrefs> => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULTS;
    const out = { ...DEFAULTS };
    for (const k of PREF_KEYS) {
      const v = (data as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  });

const PatchSchema = z.object(
  Object.fromEntries(PREF_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
    NotifPrefKey,
    z.ZodOptional<z.ZodBoolean>
  >,
);

export const updateMyNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const patch: Record<string, boolean | string> = { user_id: userId };
    for (const k of PREF_KEYS) {
      if (data[k] !== undefined) patch[k] = data[k] as boolean;
    }
    const { error } = await supabaseAdmin
      .from("notification_preferences")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(patch as any, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
