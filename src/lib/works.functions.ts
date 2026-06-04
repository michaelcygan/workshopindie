// Surviving Work-side server functions: scratch-Work creation + invite redemption.
// Tools no longer live on Works — see src/lib/workshop-tools.functions.ts for the studio.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash } from "crypto";

const SplitSchema = z.object({
  user_id: z.string().uuid().nullable(),
  role: z.string().min(1).max(80),
  name: z.string().max(120),
  pct: z.number().min(0).max(100),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  category: z.string().min(1).max(40),
  visibility: z.enum(["private", "public", "invite_only"]),
  license: z.enum(["cc_by", "rights_managed_externally", "portfolio_credit_only", "private"]),
  license_custom: z.string().max(2000).nullable(),
  credit_template: z.string().max(500).nullable(),
  commercial_use: z.enum(["yes", "no", "negotiable"]),
  splits: z.array(SplitSchema).min(1).max(20),
});

export const createCollaborativeWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof CreateSchema>) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const total = data.splits.reduce((s, x) => s + (Number(x.pct) || 0), 0);
    if (Math.round(total) !== 100) throw new Error(`Splits must total 100% (got ${total.toFixed(0)}%)`);

    // 1. Create the Work as a draft (status switches to published when the user is ready).
    const { data: work, error: wErr } = await supabase
      .from("works")
      .insert({
        title: data.title,
        description: data.description,
        category: data.category as never,
        visibility: data.visibility as never,
        license_type: data.license as never,
        credit_template: data.credit_template,
        commercial_use: data.commercial_use,
        is_collaborative: true,
        status: "draft" as never,
        source_type: "manual" as never,
        created_by: userId,
      })
      .select("id, slug")
      .single();
    if (wErr || !work) throw new Error(wErr?.message ?? "Failed to create Work");

    // 2. Snapshot the rights agreement (v1) and sign it as the creator.
    const splitsForHash = JSON.stringify(data.splits);
    const content_hash = createHash("sha256")
      .update(`${data.license}|${data.license_custom ?? ""}|${data.credit_template ?? ""}|${data.commercial_use}|${splitsForHash}`)
      .digest("hex");

    const { data: agreement, error: aErr } = await supabase
      .from("work_agreements")
      .insert({
        work_id: work.id,
        version: 1,
        license: data.license as never,
        license_custom: data.license_custom,
        credit_template: data.credit_template,
        splits: data.splits as never,
        commercial_use: data.commercial_use,
        content_hash,
        created_by: userId,
      })
      .select("id")
      .single();
    if (aErr || !agreement) throw new Error(aErr?.message ?? "Failed to record rights agreement");

    await supabase.from("work_agreement_signatures").insert({
      agreement_id: agreement.id,
      user_id: userId,
    });

    // 3. Add owner + per-split collaborators (only rows with a known user_id).
    const ownerSplit = data.splits.find((s) => s.user_id === userId);
    await supabase.from("work_collaborators").insert({
      work_id: work.id,
      user_id: userId,
      role: ownerSplit?.role ?? "Owner",
      splits_pct: ownerSplit?.pct ?? 100,
      signed_agreement_id: agreement.id,
    });
    const otherCollabs = data.splits
      .filter((s) => s.user_id && s.user_id !== userId)
      .map((s) => ({
        work_id: work.id,
        user_id: s.user_id!,
        role: s.role,
        splits_pct: s.pct,
        signed_agreement_id: null,
      }));
    if (otherCollabs.length) await supabase.from("work_collaborators").insert(otherCollabs);

    // 4. Mirror to credits so the Work shows up on profiles.
    await supabase.from("work_credits").insert({
      work_id: work.id,
      user_id: userId,
      role_label: ownerSplit?.role ?? "Owner",
      sort_order: 0,
    });

    return { slug: work.slug, id: work.id };
  });

const RedeemSchema = z.object({ token: z.string().min(8).max(128) });

export const redeemWorkInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof RedeemSchema>) => RedeemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tok, error: tErr } = await supabase
      .from("work_invite_tokens")
      .select("id, work_id, expires_at, uses_remaining")
      .eq("token", data.token)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tok) throw new Error("Invite link is invalid or has been used.");
    if (tok.expires_at && new Date(tok.expires_at) < new Date()) throw new Error("This invite has expired.");
    if (tok.uses_remaining !== null && tok.uses_remaining <= 0) throw new Error("This invite has been used up.");

    // Already on the Work? Just bounce them in.
    const { data: existing } = await supabase
      .from("work_collaborators")
      .select("id")
      .eq("work_id", tok.work_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      // Latest agreement → counter-sign it as part of joining.
      const { data: latestAgreement } = await supabase
        .from("work_agreements")
        .select("id")
        .eq("work_id", tok.work_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from("work_collaborators").insert({
        work_id: tok.work_id,
        user_id: userId,
        role: "Collaborator",
        splits_pct: 0,
        signed_agreement_id: latestAgreement?.id ?? null,
      });

      if (latestAgreement?.id) {
        await supabase.from("work_agreement_signatures").insert({
          agreement_id: latestAgreement.id,
          user_id: userId,
        });
      }
    }

    if (tok.uses_remaining !== null) {
      await supabase
        .from("work_invite_tokens")
        .update({ uses_remaining: tok.uses_remaining - 1 })
        .eq("id", tok.id);
    }

    const { data: work } = await supabase
      .from("works")
      .select("slug")
      .eq("id", tok.work_id)
      .single();

    return { slug: work?.slug ?? null };
  });
