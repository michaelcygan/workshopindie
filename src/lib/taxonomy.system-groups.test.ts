import { describe, it, expect } from "vitest";
import {
  FIELD_IDS,
  SYSTEM_FIELD_GROUP_SLUGS,
  systemGroupSlugForField,
  type FieldId,
} from "./taxonomy";

/**
 * Wave 11 lock: system ("medium") Groups follow the Field vocabulary, and a
 * Field without one is a supported state — not an error and not a reason to
 * auto-create a Group.
 */
describe("system Field groups", () => {
  it("every Field resolves to a slug or to null", () => {
    for (const id of FIELD_IDS) {
      const slug = systemGroupSlugForField(id);
      expect(slug === null || typeof slug === "string").toBe(true);
    }
  });

  it("Fields with no system Group do not auto-file", () => {
    const unsupported: FieldId[] = [
      "design",
      "performance",
      "journalism_media",
      "making_engineering",
      "science_research",
      "architecture_cities",
      "environment_nature",
      "other",
    ];
    for (const id of unsupported) {
      expect(systemGroupSlugForField(id)).toBeNull();
    }
  });

  it("normalizes legacy stored values onto the same Group", () => {
    expect(systemGroupSlugForField("build")).toBe("games-tech");
    expect(systemGroupSlugForField("games_tech")).toBe("games-tech");
    expect(systemGroupSlugForField("film")).toBe("film-video");
    expect(systemGroupSlugForField("visual")).toBe("visual-art");
    expect(systemGroupSlugForField("writing_book")).toBe("writing");
    expect(systemGroupSlugForField("audio")).toBe("music");
    expect(systemGroupSlugForField(null)).toBeNull();
  });

  it("keeps the historical Software & AI slug stable", () => {
    expect(SYSTEM_FIELD_GROUP_SLUGS.software_ai).toBe("games-tech");
  });
});
