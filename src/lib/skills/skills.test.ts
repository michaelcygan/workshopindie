import { describe, expect, it } from "vitest";
import {
  MAX_SKILLS,
  SKILL_LABEL_MAX,
  cleanSkillLabel,
  isValidSkillLabel,
  normalizeSkillLabel,
} from "@/lib/skills/normalize";
import { addSkillSchema, reorderSkillsSchema } from "@/lib/skills/schemas";
import { isPublicSkill, type Skill } from "@/lib/skills/types";

const WORK = {
  id: "w1",
  slug: "king-of-the-lake",
  title: "King of the Lake",
  cover_url: null,
  category: "film",
  category_canonical: "film",
  subtype: "Music Video",
};

function skill(over: Partial<Skill> = {}): Skill {
  return { id: "s1", position: 0, label: "Editing", work_id: "w1", work: WORK, ...over };
}

describe("skill label normalization", () => {
  it("trims and collapses whitespace while preserving capitalization", () => {
    expect(cleanSkillLabel("  Color   Grading ")).toBe("Color Grading");
  });

  it("treats case and whitespace variants as the same skill", () => {
    const keys = ["Editing", "editing", "  EDITING  ", "Editing "].map(normalizeSkillLabel);
    expect(new Set(keys).size).toBe(1);
    expect(normalizeSkillLabel("Sound  Editing")).toBe(normalizeSkillLabel(" sound editing "));
  });


  it("rejects blank labels", () => {
    expect(isValidSkillLabel("   ")).toBe(false);
    expect(isValidSkillLabel("Editing")).toBe(true);
  });

  it("caps label length", () => {
    expect(cleanSkillLabel("a".repeat(200))).toHaveLength(SKILL_LABEL_MAX);
  });
});

describe("skill schemas", () => {
  it("requires a linked work", () => {
    expect(addSkillSchema.safeParse({ label: "Editing" }).success).toBe(false);
  });

  it("rejects a blank label even with a work", () => {
    const res = addSkillSchema.safeParse({
      label: "   ",
      work_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a valid pair and normalizes the label", () => {
    const res = addSkillSchema.parse({
      label: "  Editing  ",
      work_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.label).toBe("Editing");
  });

  it("caps reorder payloads at the max skill count", () => {
    const ids = Array.from({ length: MAX_SKILLS + 1 }, () => "11111111-1111-4111-8111-111111111111");
    expect(reorderSkillsSchema.safeParse({ ids }).success).toBe(false);
  });
});

describe("public visibility", () => {
  it("counts a skill with live public evidence", () => {
    expect(isPublicSkill(skill())).toBe(true);
  });

  it("hides a skill whose work is gone or no longer public", () => {
    expect(isPublicSkill(skill({ work: null }))).toBe(false);
    expect(isPublicSkill(skill({ work_id: null, work: null }))).toBe(false);
  });

  it("allows several distinct skills to share one work", () => {
    const a = skill({ id: "s1", label: "Editing" });
    const b = skill({ id: "s2", label: "Color" });
    expect(a.work_id).toBe(b.work_id);
    expect(normalizeSkillLabel(a.label)).not.toBe(normalizeSkillLabel(b.label));
  });
});
