import { describe, it, expect } from "vitest";
import {
  FIELD_IDS,
  FIELD_OPTIONS,
  fieldLabel,
  fieldToLegacyEnum,
  fieldsForStoredValues,
  formatSuggestionsFor,
  normalizeField,
  storageValuesFor,
} from "./taxonomy";

describe("Field vocabulary", () => {
  it("exposes exactly the shared disciplinary vocabulary", () => {
    expect(FIELD_OPTIONS.map((f) => f.id)).toEqual([...FIELD_IDS]);
    expect(FIELD_OPTIONS.map((f) => f.label)).toContain("Software & AI");
    expect(FIELD_OPTIONS.map((f) => f.label)).not.toContain("Games & Tech");
  });

  it("normalizes legacy stored values onto Fields", () => {
    expect(normalizeField("build")).toBe("software_ai");
    expect(normalizeField("games_tech")).toBe("software_ai");
    expect(normalizeField("film")).toBe("film_video");
    expect(normalizeField("visual")).toBe("visual_art");
    expect(normalizeField("writing_book")).toBe("writing");
    expect(normalizeField("audio")).toBe("music");
    expect(normalizeField(null)).toBe("other");
  });

  it("never labels a Field 'Games & Tech'", () => {
    expect(fieldLabel("build")).toBe("Software & AI");
    expect(fieldLabel("games_tech")).toBe("Software & AI");
  });

  it("prefers canonical values and falls back to legacy ones", () => {
    expect(fieldsForStoredValues(["software_ai", "science_research"], ["build"])).toEqual([
      "software_ai",
      "science_research",
    ]);
    expect(fieldsForStoredValues([], ["build", "film"])).toEqual(["software_ai", "film_video"]);
    expect(fieldsForStoredValues([null], null)).toEqual([]);
  });

  it("keeps legacy rows discoverable under the modern Field", () => {
    expect(storageValuesFor("software_ai")).toEqual(["build", "games_tech", "software_ai"]);
    expect(storageValuesFor("film_video")).toEqual(["film", "film_video"]);
  });

  it("maps new Fields to a legacy enum value for the NOT NULL compat columns", () => {
    expect(fieldToLegacyEnum("science_research")).toBe("build");
    expect(fieldToLegacyEnum("making_engineering")).toBe("build");
    expect(fieldToLegacyEnum("journalism_media")).toBe("writing");
    expect(fieldToLegacyEnum("design")).toBe("visual");
  });

  it("merges Format suggestions across selected Fields", () => {
    const formats = formatSuggestionsFor(["software_ai", "science_research"]);
    expect(formats).toContain("Benchmark");
    expect(formats).toContain("Dataset");
    expect(formats.filter((f) => f === "Benchmark")).toHaveLength(1);
  });
});
