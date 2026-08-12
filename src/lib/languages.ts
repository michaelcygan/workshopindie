/**
 * Canonical profile languages.
 *
 * Profile "Languages" is a fixed picker, not free text. Each supported
 * language optionally maps to a system Language Group (`groups.system_type =
 * 'language'`, `groups.taxonomy_key = <key>`). A database trigger on
 * `profiles.languages` joins the member to the matching group automatically.
 *
 * To launch a new language: create the group with its `taxonomy_key`, then add
 * one entry to LANGUAGES below. Keep the aliases in sync with the SQL helper
 * `public.language_key(text)`.
 */

export type LanguageKey = "en" | "es";

export type LanguageOption = {
  key: LanguageKey;
  /** Stored value in `profiles.languages` and shown on the profile. */
  label: string;
  /** Route slug of the Language Group, if one exists. */
  groupSlug: string | null;
  /** Human name of the Language Group, for inline copy. */
  groupName: string | null;
};

export const LANGUAGES: readonly LanguageOption[] = [
  { key: "en", label: "English", groupSlug: null, groupName: null },
  {
    key: "es",
    label: "Español",
    groupSlug: "creadores-en-espanol",
    groupName: "Creadores en Español",
  },
] as const;

const ALIASES: Record<string, LanguageKey> = {
  english: "en",
  en: "en",
  inglés: "en",
  ingles: "en",
  spanish: "es",
  es: "es",
  español: "es",
  espanol: "es",
  castellano: "es",
};

const BY_KEY = new Map(LANGUAGES.map((l) => [l.key, l]));

/** Canonical key for a stored/typed language value, or null when unsupported. */
export function normalizeLanguage(raw: string | null | undefined): LanguageKey | null {
  if (!raw) return null;
  return ALIASES[raw.trim().toLocaleLowerCase()] ?? null;
}

export function languageByKey(key: string | null | undefined): LanguageOption | null {
  return key ? (BY_KEY.get(key as LanguageKey) ?? null) : null;
}

/** Canonical, de-duplicated labels for a stored languages array. */
export function canonicalLanguageLabels(
  values: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  const seen = new Set<LanguageKey>();
  const out: string[] = [];
  for (const v of values ?? []) {
    const key = normalizeLanguage(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(BY_KEY.get(key)!.label);
  }
  return out;
}
