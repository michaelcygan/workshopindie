import { describe, expect, it } from "vitest";
import {
  MAX_SKILLS,
  MAX_SKILL_WORKS,
  SKILL_DESCRIPTION_MAX,
  SKILL_LABEL_MAX,
  cleanSkillDescription,
  cleanSkillLabel,
  isValidSkillLabel,
  normalizeSkillLabel,
} from "@/lib/skills/normalize";
import { addSkillSchema, reorderSkillsSchema } from "@/lib/skills/schemas";
import { isPublicSkill, type Skill, type SkillWork } from "@/lib/skills/types";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

const WORK: SkillWork = {
  id: "w1",
  slug: "king-of-the-lake",
  title: "King of the Lake",
  cover_url: null,
  category: "film",
  category_canonical: "film",
  subtype: "Music Video",
};

function skill(over: Partial<Skill> = {}): Skill {
  return {
    id: "s1",
    position: 0,
    label: "Editing",
    description: null,
    work_id: "w1",
    works: [WORK],
    missing_count: 0,
    work: WORK,
    ...over,
  };
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

describe("skill description", () => {
  it("returns null for blank or missing input", () => {
    expect(cleanSkillDescription("   ")).toBeNull();
    expect(cleanSkillDescription(null)).toBeNull();
    expect(cleanSkillDescription(undefined)).toBeNull();
  });

  it("collapses whitespace and caps at 150 characters", () => {
    expect(cleanSkillDescription(" Trailer   cutting ")).toBe("Trailer cutting");
    expect(cleanSkillDescription("a".repeat(400))).toHaveLength(SKILL_DESCRIPTION_MAX);
  });
});

describe("skill schemas", () => {
  it("requires at least one linked work", () => {
    expect(addSkillSchema.safeParse({ label: "Editing", work_ids: [] }).success).toBe(false);
    expect(addSkillSchema.safeParse({ label: "Editing" }).success).toBe(false);
  });

  it("rejects a blank label even with a work", () => {
    expect(addSkillSchema.safeParse({ label: "   ", work_ids: [UUID] }).success).toBe(false);
  });

  it("accepts several works and dedupes them", () => {
    const res = addSkillSchema.parse({
      label: "  Editing  ",
      description: "  Trailer cutting  ",
      work_ids: [UUID, UUID2, UUID],
    });
    expect(res.label).toBe("Editing");
    expect(res.description).toBe("Trailer cutting");
    expect(res.work_ids).toEqual([UUID, UUID2]);
  });

  it("caps the number of linked works", () => {
    const ids = Array.from({ length: MAX_SKILL_WORKS + 1 }, (_, i) => `${i}1111111-1111-4111-8111-111111111111`);
    expect(addSkillSchema.safeParse({ label: "Editing", work_ids: ids }).success).toBe(false);
  });

  it("caps reorder payloads at the max skill count", () => {
    const ids = Array.from({ length: MAX_SKILLS + 1 }, () => UUID);
    expect(reorderSkillsSchema.safeParse({ ids }).success).toBe(false);
  });
});

describe("public visibility", () => {
  it("counts a skill with live public evidence", () => {
    expect(isPublicSkill(skill())).toBe(true);
  });

  it("still shows when only some linked works went private", () => {
    expect(isPublicSkill(skill({ works: [WORK], missing_count: 2 }))).toBe(true);
  });

  it("hides a skill whose works are all gone or no longer public", () => {
    expect(isPublicSkill(skill({ works: [], work: null, missing_count: 1 }))).toBe(false);
  });

  it("allows several distinct skills to share one work", () => {
    const a = skill({ id: "s1", label: "Editing" });
    const b = skill({ id: "s2", label: "Color" });
    expect(a.works[0].id).toBe(b.works[0].id);
    expect(normalizeSkillLabel(a.label)).not.toBe(normalizeSkillLabel(b.label));
  });
});
