/**
 * Skill label rules. Shared by client and server so validation messages match.
 * A Skill label is member-authored text — it is never a taxonomy id.
 */
export const MAX_SKILLS = 10;
export const SKILL_LABEL_MAX = 60;

/** Trim + collapse internal whitespace. Preserves the member's capitalization. */
export function cleanSkillLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, SKILL_LABEL_MAX);
}

/** Case-insensitive key used for duplicate prevention. */
export function normalizeSkillLabel(raw: string): string {
  return cleanSkillLabel(raw).toLowerCase();
}

export function isValidSkillLabel(raw: string): boolean {
  const cleaned = cleanSkillLabel(raw);
  return cleaned.length > 0 && cleaned.length <= SKILL_LABEL_MAX;
}
