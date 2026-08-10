import { describe, expect, it } from "vitest";
import {
  BLOG_CATEGORIES,
  fieldForBlogCategory,
  isLegacyBlogSlug,
  resolveBlogSlug,
} from "@/lib/blog-categories";
import {
  FIELD_IDS,
  SUBCATEGORIES,
  assertValidTaxonomy,
  fieldForSubcategory,
  fieldLabel,
  isSubcategoryOf,
  normalizeFieldList,
  normalizeFieldSelection,
  normalizeSpecialties,
  normalizeSubcategory,
  subcategoriesForField,
  subcategoryForPrimary,
} from "@/lib/taxonomy";

describe("subcategory vocabulary", () => {
  it("has the canonical 210 subcategories", () => {
    expect(SUBCATEGORIES).toHaveLength(210);
  });

  it("gives General no subcategories", () => {
    expect(subcategoriesForField("other")).toHaveLength(0);
  });

  it("uses namespaced ids matching their parent field", () => {
    for (const s of SUBCATEGORIES) {
      expect(s.id.startsWith(`${s.field}.`)).toBe(true);
      expect(fieldForSubcategory(s.id)).toBe(s.field);
    }
  });

  it("matches the spec's example ids", () => {
    for (const id of [
      "music.songwriting",
      "visual_art.photography",
      "software_ai.game_development",
      "science_research.medicine_public_health",
    ]) {
      expect(normalizeSubcategory(id)).toBe(id);
    }
  });

  it("has unique ids", () => {
    expect(new Set(SUBCATEGORIES.map((s) => s.id)).size).toBe(SUBCATEGORIES.length);
  });

  it("keeps Health off the top level and Medicine under Science & Research", () => {
    expect(FIELD_IDS).not.toContain("health" as never);
    expect(fieldForSubcategory("science_research.medicine_public_health")).toBe("science_research");
  });

  it("rejects a subcategory under the wrong field", () => {
    expect(isSubcategoryOf("music.songwriting", "design")).toBe(false);
    expect(subcategoryForPrimary("music.songwriting", "design")).toBeNull();
    expect(subcategoryForPrimary("music.songwriting", "music")).toBe("music.songwriting");
  });

  it("drops unknown subcategory ids instead of coercing them", () => {
    expect(normalizeSubcategory("music.not_a_thing")).toBeNull();
  });
});

describe("field selection rules", () => {
  it("makes General stand alone", () => {
    expect(normalizeFieldSelection("other", ["music"]).fields).toEqual(["other"]);
    expect(normalizeFieldSelection("music", ["other", "design"]).fields).toEqual([
      "music",
      "design",
    ]);
    expect(normalizeFieldList(["other", "music"])).toEqual(["music"]);
    expect(normalizeFieldList(["other"])).toEqual(["other"]);
  });

  it("dedupes and caps", () => {
    expect(
      normalizeFieldSelection("music", ["music", "design", "writing", "performance"]).fields,
    ).toEqual(["music", "design", "writing"]);
  });

  it("validates content taxonomy on the server", () => {
    expect(assertValidTaxonomy({ primary: "music", subcategory: "music.djing" }).subcategory).toBe(
      "music.djing",
    );
    expect(() => assertValidTaxonomy({ primary: "music", subcategory: "design.typography" })).toThrow();
    expect(() => assertValidTaxonomy({ primary: "music", subcategory: "nope" })).toThrow();
  });

  it("scopes profile specialties to the chosen fields and caps at 12", () => {
    const chosen = normalizeSpecialties(
      ["music.djing", "design.typography", "music.djing", "bogus"],
      ["music"],
    );
    expect(chosen).toEqual(["music.djing"]);
    const many = normalizeSpecialties(
      subcategoriesForField("design").map((s) => s.id),
      ["design"],
    );
    expect(many).toHaveLength(12);
  });
});

describe("blog sections", () => {
  it("exposes all 13 fields as sections", () => {
    expect(BLOG_CATEGORIES).toHaveLength(FIELD_IDS.length);
    expect(BLOG_CATEGORIES.map((c) => c.slug)).toContain("architecture-urbanism");
  });

  it("keeps the legacy games-tech slug working", () => {
    expect(resolveBlogSlug("games-tech")).toBe("software-ai");
    expect(isLegacyBlogSlug("games-tech")).toBe(true);
    expect(fieldForBlogCategory("games-tech")).toBe("software_ai");
  });

  it("labels General as General", () => {
    expect(fieldLabel("other")).toBe("General");
  });
});
