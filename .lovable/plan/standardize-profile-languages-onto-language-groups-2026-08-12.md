# Standardize profile languages onto Language Groups

Today profile "Languages" is a free-text tag field (up to 8, anything typed). Groups has exactly one language-category group: **Creadores en Español**. This plan turns languages into a fixed picker tied to that group set, and auto-joins the matching group when a member selects a language.

## What changes for members

- The Languages field in Edit Profile becomes a **picker of the supported languages** — no free typing. Launch set: **English** and **Español (Spanish)**.
- English is the site default and has no group. Selecting **Español** joins **Creadores en Español** automatically on save, with a short inline note ("Joins the Creadores en Español group").
- Removing Español from the profile does **not** kick the member out of the group — they can leave from the group page. This avoids surprise removals from a scene they're active in.
- Profile About still displays the selected languages as chips, unchanged visually.

## Existing data

A one-time pass normalizes what people already typed:
- Entries matching a launch language ("spanish", "español", "es", "castellano", "english", "en", "inglés") are rewritten to the canonical label and, for Spanish, the member is added to Creadores en Español.
- Anything else already on a profile is dropped from the field, since the picker no longer supports free entry.

## Adding more languages later

The language set lives in one file plus a `taxonomy_key` on the group row, so launching e.g. French is: create the group with its language key, add one entry to the list. No other code changes.

## Technical notes

- New `src/lib/languages.ts`: canonical list `{ key: 'en' | 'es', label, nativeLabel, groupSlug | null }`, plus `normalizeLanguage(raw)` handling the alias table above. Client-safe, used by the editor, the profile display, and the tests.
- Migration:
  - Tag the existing group: `groups.system_type = 'language'`, `taxonomy_key = 'es'` (mirrors the Medium Group pattern already used by `medium_group_id`).
  - `public.language_group_id(_key text)` — STABLE SECURITY DEFINER lookup, same shape as `medium_group_id`.
  - `public.sync_profile_language_groups(_user_id uuid)` — for each key in `profiles.languages` with a group, insert into `group_members` (ON CONFLICT DO NOTHING) and bump `member_count`, reusing the existing membership helper so RLS/count logic stays in one place.
  - `tg_profiles_language_groups` AFTER INSERT OR UPDATE OF `languages` ON `profiles` calling the sync function.
  - Data backfill in the same migration: normalize `profiles.languages` to canonical labels, drop unsupported values, then run the sync for every affected profile.
- `src/routes/me.edit.tsx`: replace `LanguagesField`'s free-text input with toggle chips over the canonical list; delete `cleanLanguages`/`MAX_LANGUAGES` free-entry logic and validate against the canonical keys before save.
- `src/routes/$username.tsx`: render through the canonical labels so legacy rows display consistently.
- Unit test for `normalizeLanguage` covering the alias table and unsupported input.
