/**
 * Quick Work creation used by the Blog editor's "About this post" panel.
 *
 * Mirrors the essentials of `/works/new` (published, public, self credit,
 * portfolio-credit license, manual source) minus cover framing, book fields
 * and group tagging, so a writer can create the missing Work without leaving
 * the post. Server-only: quota + moderation are enforced here, not in the UI.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { moderateFields } from "@/lib/moderation/service.server";
import { resolveEffectivePlusAccess } from "@/lib/plus-access.server";
import { FREE_PUBLISHED_WORK_CAP } from "@/lib/entitlements";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type QuickWorkInput = {
  title: string;
  category: string;
  subtype: string | null;
  primary_url: string | null;
};

export type QuickWorkResult = {
  id: string;
  slug: string;
  title: string;
  category: string;
  subtype: string | null;
};

export { WORK_LIMIT_ERROR } from "@/lib/works-quick.shared";
import { WORK_LIMIT_ERROR } from "@/lib/works-quick.shared";


export async function createQuickWorkServer(
  context: AuthContext,
  input: QuickWorkInput,
): Promise<QuickWorkResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the Work a title.");

  await moderateFields(context.userId, "works.quick_create", { title });

  const access = await resolveEffectivePlusAccess(context.userId);
  if (!access.isPlus) {
    const { count } = await context.supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("created_by", context.userId)
      .eq("status", "published");
    if ((count ?? 0) >= FREE_PUBLISHED_WORK_CAP) throw new Error(WORK_LIMIT_ERROR);
  }

  const { data: work, error } = await context.supabase
    .from("works")
    .insert({
      title,
      slug: "",
      category: input.category as Database["public"]["Enums"]["category"],
      categories: [input.category] as Database["public"]["Enums"]["category"][],
      subtype: input.subtype,
      primary_url: input.primary_url,
      source_type: "manual",
      license_type: "portfolio_credit_only",
      ownership_certified_at: new Date().toISOString(),
      status: "published",
      visibility: "public",
      created_by: context.userId,
    })
    .select("id,slug,title,category,subtype")
    .single();

  if (error || !work) throw new Error(error?.message ?? "Could not create that Work.");

  await context.supabase.from("work_credits").insert({
    work_id: work.id,
    user_id: context.userId,
    display_name: null,
    role_label: "Creator",
    sort_order: 0,
  });

  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    category: work.category as string,
    subtype: (work.subtype as string | null) ?? null,
  };
}
