export {
  MAX_SKILLS,
  MAX_SKILL_WORKS,
  SKILL_DESCRIPTION_MAX,
  SKILL_LABEL_MAX,
} from "@/lib/skills/normalize";

/** Live Work data joined onto a Skill row. */
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
  description: string | null;
  /** Legacy first-work pointer, kept in sync with works[0]. */
  work_id: string | null;
  /** Live public Works, in the member's chosen order. */
  works: SkillWork[];
  /** Linked Works that are no longer public — owner-facing signal only. */
  missing_count: number;
  /** Convenience: the first live Work, or null. */
  work: SkillWork | null;
};

/** A Work the member may use as Skill evidence. */
export type EligibleWork = SkillWork & {
  published_at: string | null;
  /** The member's credit role when they are a credited contributor, not the creator. */
  role_label: string | null;
  owned: boolean;
};

/** A Skill only counts publicly when at least one piece of evidence is live. */
export function isPublicSkill(skill: Skill): boolean {
  return skill.works.length > 0;
}
