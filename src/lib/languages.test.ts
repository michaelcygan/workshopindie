import { describe, expect, it } from "vitest";
import { canonicalLanguageLabels, languageByKey, normalizeLanguage } from "./languages";

describe("normalizeLanguage", () => {
  it("maps English aliases", () => {
    for (const v of ["English", "english", " EN ", "Inglés", "ingles"]) {
      expect(normalizeLanguage(v)).toBe("en");
    }
  });

  it("maps Spanish aliases", () => {
    for (const v of ["Spanish", "español", "Espanol", "castellano", "es"]) {
      expect(normalizeLanguage(v)).toBe("es");
    }
  });

  it("rejects unsupported input", () => {
    for (const v of ["ASL", "", null, undefined, "franglais"]) {
      expect(normalizeLanguage(v)).toBeNull();
    }
  });
});

describe("canonicalLanguageLabels", () => {
  it("canonicalizes, de-duplicates and drops unsupported values", () => {
    expect(canonicalLanguageLabels(["spanish", "Español", "ASL", "en"])).toEqual([
      "Español",
      "English",
    ]);
  });

  it("handles empty input", () => {
    expect(canonicalLanguageLabels(null)).toEqual([]);
  });
});

describe("languageByKey", () => {
  it("exposes the Spanish group link", () => {
    expect(languageByKey("es")?.groupSlug).toBe("creadores-en-espanol");
    expect(languageByKey("en")?.groupSlug).toBeNull();
    expect(languageByKey("fr")).toBeNull();
  });
});
