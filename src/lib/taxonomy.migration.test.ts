import { describe, expect, it } from "vitest";
import {
  CATEGORY_ENUM_VALUES,
  FIELD_FILTER_OPTIONS,
  FIELD_IDS,
  categoryLabel,
  fieldLabel,
  fieldToLegacyEnum,
  fieldsForStoredValues,
  normalizeField,
  systemGroupSlugForField,
} from "@/lib/taxonomy";
import { CATEGORIES, WORK_CATEGORY_IDS, categoryClass } from "@/lib/categories";

/**
 * Wave 14 — regressions for the Field/Format migration.
 * These lock the boundaries that broke during the migration: interdisciplinary
 * rows, legacy stored values, and the legacy enum that still backs writes.
 */
describe("interdisciplinary rows", () => {
  it("keeps every meaningful Field, canonical first", () => {
    expect(
      fieldsForStoredValues(["film_video", "software_ai", "music"], ["build"]),
    ).toEqual(["film_video", "software_ai", "music"]);
  });

  it("falls back to legacy values only when canonical is empty", () => {
    expect(fieldsForStoredValues([], ["build", "visual"])).toEqual([
      "software_ai",
      "visual_art",
    ]);
    expect(fieldsForStoredValues(null, null)).toEqual([]);
  });

  it("dedupes Fields that several legacy values collapse into", () => {
    expect(fieldsForStoredValues(null, ["writing", "writing_book"])).toEqual([
      "writing",
    ]);
    expect(fieldsForStoredValues(null, ["build", "games_tech"])).toEqual([
      "software_ai",
    ]);
  });

  it("drops 'other' when a real Field is present, keeps it when alone", () => {
    expect(fieldsForStoredValues(["other", "design"])).toEqual(["design"]);
    expect(fieldsForStoredValues(["other"])).toEqual(["other"]);
  });
});

describe("label resolution never leaks raw ids", () => {
  it("labels every canonical Field", () => {
    for (const id of FIELD_IDS) {
      expect(fieldLabel(id)).not.toMatch(/_/);
      expect(categoryLabel(id)).not.toMatch(/_/);
    }
  });

  it("labels legacy stored values with the modern Field name", () => {
    expect(categoryLabel("build")).toBe("Software & AI");
    expect(categoryLabel("games_tech")).toBe("Software & AI");
    expect(categoryLabel("visual")).toBe("Visual Art");
    expect(categoryLabel("film")).toBe("Film & Video");
  });

  it("still labels conversation topics, which are not Fields", () => {
    expect(categoryLabel("open_mic")).toBe("Open Mic");
    expect(normalizeField("open_mic")).toBe("other");
  });

  it("degrades unknown values to Other rather than echoing them", () => {
    expect(categoryLabel("wildly_unknown")).toBe("Other");
    expect(fieldLabel(null)).toBe("Other");
  });
});

describe("discovery filters", () => {
  it("offers every Field except the Other fallback", () => {
    expect(FIELD_FILTER_OPTIONS.map((o) => o.id)).toEqual(
      FIELD_IDS.filter((id) => id !== "other"),
    );
  });
});

describe("legacy enum compatibility", () => {
  it("maps every Field to a value the category enum accepts", () => {
    for (const id of FIELD_IDS) {
      expect(CATEGORY_ENUM_VALUES.has(fieldToLegacyEnum(id))).toBe(true);
    }
  });

  it("only exposes enum-valid ids in the legacy picker, with Field labels", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_ENUM_VALUES.has(c.id)).toBe(true);
      expect(c.label).not.toMatch(/_/);
      expect(categoryClass(c.id)).toBeTruthy();
    }
    expect(CATEGORIES.find((c) => c.id === "build")?.label).toBe("Software & AI");
    for (const id of WORK_CATEGORY_IDS) {
      expect(CATEGORY_ENUM_VALUES.has(id)).toBe(true);
    }
  });
});

describe("system group filing", () => {
  it("files legacy values into the same Group as their Field", () => {
    expect(systemGroupSlugForField("build")).toBe("games-tech");
    expect(systemGroupSlugForField("games_tech")).toBe("games-tech");
    expect(systemGroupSlugForField("software_ai")).toBe("games-tech");
    expect(systemGroupSlugForField("visual")).toBe("visual-art");
  });

  it("does not invent a Group for Fields without one", () => {
    expect(systemGroupSlugForField("design")).toBeNull();
    expect(systemGroupSlugForField("open_mic")).toBeNull();
  });
});
