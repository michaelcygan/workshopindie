export { MAX_SKILLS, SKILL_LABEL_MAX } from "@/lib/skills/normalize";

/** Live Work data joined onto a Skill row. Null when the evidence is gone. */
export type SkillWork = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  category_canonical: string | null;
  category: string | null;
  subtype: string | null;
};

export type Skill = {
  id: string;
  position: number;
  label: string;
  work_id: string | null;
  /** Present only when the linked Work is still published + public. */
  work: SkillWork | null;
};

/** A Work the member may use as Skill evidence. */
export type EligibleWork = SkillWork & {
  published_at: string | null;
  /** The member's credit role when they are a credited contributor, not the creator. */
  role_label: string | null;
  owned: boolean;
};

/** A Skill only counts publicly when its evidence is still live. */
export function isPublicSkill(skill: Skill): boolean {
  return !!skill.work;
}
