import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  entityType: z.enum(["work", "workshop", "profile", "collab"]),
  entityId: z.string().uuid(),
  channel: z.enum(["copy", "native", "twitter", "facebook", "whatsapp", "email", "other"]),
});

export const logShare = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("share_events")
      .insert({
        entity_type: data.entityType,
        entity_id: data.entityId,
        channel: data.channel,
      })
      .then(() => null, () => null);
    return { ok: true as const };
  });

const referralSchema = z.object({
  referrerUsername: z.string().min(1).max(30),
});

export const attributeReferral = createServerFn({ method: "POST" })
  .inputValidator((input) => referralSchema.parse(input))
  .handler(async ({ data }) => {
    // Look up referrer profile by username
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.referrerUsername.toLowerCase())
      .maybeSingle();
    if (!referrer) return { ok: false as const, reason: "no_referrer" };

    return { ok: true as const, referrerId: referrer.id };
  });

const setReferralSchema = z.object({
  userId: z.string().uuid(),
  referrerId: z.string().uuid(),
});

export const setReferredBy = createServerFn({ method: "POST" })
  .inputValidator((input) => setReferralSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.userId === data.referrerId) return { ok: false as const };
    // Only set if currently null (idempotent, prevents overwrite)
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", data.userId)
      .maybeSingle();
    if (!existing || existing.referred_by) return { ok: false as const };
    await supabaseAdmin
      .from("profiles")
      .update({ referred_by: data.referrerId })
      .eq("id", data.userId)
      .is("referred_by", null);
    return { ok: true as const };
  });
