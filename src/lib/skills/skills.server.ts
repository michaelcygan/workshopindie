/**
 * Server-only Skill logic. Called from src/lib/skills.functions.ts handlers via
 * dynamic import so it never enters the client graph.
 *
 * Core rule: a Skill may only point at a Work the member is actually connected
 * to — created by them, or credited to them without hiding the credit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_SKILLS, cleanSkillLabel, normalizeSkillLabel } from "@/lib/skills/normalize";
import type { AddSkillInput, UpdateSkillInput } from "@/lib/skills/schemas";
import type { EligibleWork } from "@/lib/skills/types";

type Db = SupabaseClient<Database>;

const WORK_FIELDS = "id,slug,title,cover_url,category,category_canonical,subtype,published_at";

type RawWork = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  category: string | null;
  category_canonical: string | null;
  subtype: string | null;
  published_at: string | null;
};

/** Published + public Works the member created or is visibly credited on. */
export async function listEligibleWorks(db: Db, userId: string): Promise<EligibleWork[]> {
  const [ownedRes, creditedRes] = await Promise.all([
    db
      .from("works")
      .select(WORK_FIELDS)
      .eq("created_by", userId)
      .eq("status", "published")
      .eq("visibility", "public"),
    db
      .from("work_credits")
      .select(`role_label, work:works!inner(${WORK_FIELDS},status,visibility)`)
      .eq("user_id", userId)
      .eq("hidden_from_profile", false),
  ]);

  const byId = new Map<string, EligibleWork>();

  for (const w of (ownedRes.data ?? []) as RawWork[]) {
    byId.set(w.id, { ...w, role_label: null, owned: true });
  }

  type CreditRow = { role_label: string | null; work: (RawWork & { status: string; visibility: string }) | null };
  for (const row of (creditedRes.data ?? []) as unknown as CreditRow[]) {
    const w = row.work;
    if (!w || w.status !== "published" || w.visibility !== "public") continue;
    const existing = byId.get(w.id);
    if (existing) {
      if (!existing.role_label) existing.role_label = row.role_label ?? null;
      continue;
    }
    const { status: _s, visibility: _v, ...rest } = w;
    byId.set(w.id, { ...rest, role_label: row.role_label ?? null, owned: false });
  }

  return [...byId.values()].sort((a, b) => {
    const at = a.published_at ? Date.parse(a.published_at) : 0;
    const bt = b.published_at ? Date.parse(b.published_at) : 0;
    return bt - at;
  });
}

/** Throws a user-facing error when the member may not use this Work as evidence. */
export async function assertEligibleWork(db: Db, userId: string, workId: string): Promise<void> {
  const { data: work } = await db
    .from("works")
    .select("id,created_by,status,visibility")
    .eq("id", workId)
    .maybeSingle();

  if (!work) throw new Error("That Work is no longer available.");
  if (work.status !== "published" || work.visibility !== "public") {
    throw new Error("Only published, public Works can demonstrate a skill.");
  }
  if (work.created_by === userId) return;

  const { data: credit } = await db
    .from("work_credits")
    .select("id")
    .eq("work_id", workId)
    .eq("user_id", userId)
    .eq("hidden_from_profile", false)
    .maybeSingle();

  if (!credit) {
    throw new Error("You can only link a Work you made or hold a visible credit on.");
  }
}

function friendlyDbError(message: string): string {
  if (/at most 10 skills/i.test(message)) return `You can have at most ${MAX_SKILLS} skills.`;
  if (/uq_profile_skills_label/i.test(message)) return "You've already added that skill.";
  return message;
}

async function nextPosition(db: Db, userId: string): Promise<number> {
  const { data } = await db
    .from("profile_skills")
    .select("position")
    .eq("profile_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export async function insertSkill(db: Db, userId: string, input: AddSkillInput) {
  await assertEligibleWork(db, userId, input.work_id);
  const label = cleanSkillLabel(input.label);
  const { data, error } = await db
    .from("profile_skills")
    .insert({
      profile_id: userId,
      label,
      normalized_label: normalizeSkillLabel(label),
      work_id: input.work_id,
      position: await nextPosition(db, userId),
    })
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));
  return { id: data.id };
}

export async function patchSkill(db: Db, userId: string, input: UpdateSkillInput) {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) {
    const label = cleanSkillLabel(input.label);
    patch.label = label;
    patch.normalized_label = normalizeSkillLabel(label);
  }
  if (input.work_id !== undefined) {
    await assertEligibleWork(db, userId, input.work_id);
    patch.work_id = input.work_id;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await db
    .from("profile_skills")
    .update(patch)
    .eq("id", input.id)
    .eq("profile_id", userId);
  if (error) throw new Error(friendlyDbError(error.message));
  return { ok: true };
}

export async function deleteSkill(db: Db, userId: string, id: string) {
  const { error } = await db
    .from("profile_skills")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);
  if (error) throw new Error(error.message);
  await resequence(db, userId);
  return { ok: true };
}

export async function applySkillOrder(db: Db, userId: string, ids: string[]) {
  const { data: owned } = await db
    .from("profile_skills")
    .select("id")
    .eq("profile_id", userId);
  const ownedIds = new Set((owned ?? []).map((r) => r.id));
  const ordered = ids.filter((id) => ownedIds.has(id));

  for (let i = 0; i < ordered.length; i++) {
    const { error } = await db
      .from("profile_skills")
      .update({ position: i })
      .eq("id", ordered[i])
      .eq("profile_id", userId);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

/** Keep positions dense after a removal. */
async function resequence(db: Db, userId: string) {
  const { data } = await db
    .from("profile_skills")
    .select("id")
    .eq("profile_id", userId)
    .order("position", { ascending: true });
  await applySkillOrder(db, userId, (data ?? []).map((r) => r.id));
}
