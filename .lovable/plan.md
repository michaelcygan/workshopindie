# Basic Language Support

Add an optional `languages` field to profiles, editable in the profile editor and rendered as chips in the public profile's About tab. No Group, Lounge, onboarding, or matching changes.

## Wave 1 — Migration

New migration `add_profile_languages.sql`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

GRANT SELECT (languages) ON public.profiles TO anon;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, username, display_name, avatar_url, cover_url, city_id, home_city_id,
  headline, bio, artist_statement, categories, mediums, tools, external_links,
  instagram_handle, creator_status, pinned_work_ids, cover_work_id,
  work_count, follower_count, following_count, worked_with_count,
  aliases, discoverable, indexable, hide_group_memberships,
  event_visibility, show_online, dm_policy, preferred_language,
  onboarded, languages, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
```

Types regenerate on approval.

## Wave 2 — `src/routes/me.edit.tsx`

- Rename `location` section: label → `Location & languages`, subtitle → `Help people understand where you are and how you connect.` (Section id stays `location` to avoid touching `SectionId` union / mobile nav — only the visible label/subtitle change.)
- `FormState`: add `languages: string[]` + empty state `[]`.
- Extend profile SELECT to include `languages`; hydrate `((data.languages as string[] | null) ?? [])`.
- Add `cleanLanguages()` (trim, dedupe case-insensitive, cap 40 chars, max 8) and apply before `supabase.update` and to the local saved state.
- Add `LanguagesField` component next to `ToolsField` (same chip pattern, Enter/comma/blur commit, backspace remove, disabled at cap, `2/8` counter). Placeholder: `English, Spanish, ASL…`. Helper: `Languages you are comfortable creating or connecting in. Shown in the About section of your profile.`
- Render it inside the existing Location section, directly below the City selector. No new section, no ToolsField refactor.

## Wave 3 — `src/routes/u.$username.tsx`

- Add `languages: string[] | null` to local `Profile` type.
- Append `,languages` to `baseCols` — nothing else in that query changes.
- In `AboutTab`, insert a new `<section>` between "Based in" and Mediums, guarded by `(profile.languages?.filter(Boolean).length ?? 0) > 0`, using the exact chip markup from the spec (border/surface pill, xs uppercase heading).
- No changes to identity row, metadata row, cards, SEO, OG, completion scoring, or any other surface.

## Wave 4 — Language Groups

Code unchanged. Existing admin Group creation at `/admin/groups` already supports `scene` kind with name + tagline, and Group search already matches both. Deliverable is a note to admins with the launch set (Creadores en Español, Créateurs Francophones, Criadores em Português, Arabic-Speaking Creators, ASL Creators) and suggested bilingual taglines — created manually through the existing admin UI, not seeded.

## Wave 5 — Validation

After each wave: `tsgo --noEmit`, spot-check preview (edit → add → dedupe → save → reload → About shows chips → remove all → section disappears), mobile viewport check, confirm no diff outside the three files.

## Files touched

- `supabase/migrations/<new>.sql` (add column, extend view + grant)
- `src/integrations/supabase/types.ts` (regenerated)
- `src/routes/me.edit.tsx`
- `src/routes/u.$username.tsx`

## Explicitly untouched

Onboarding, Lounge code/RPCs, Group schema/kinds/admin functions, `ToolsField`, profile RLS policies, `SectionId` union, mobile section nav, SEO/OG, profile-completion scoring, any other profile query across the app.

## Risks

- **View recreation** — `CREATE OR REPLACE VIEW` with an added column at the end is safe; consumer queries select by name.
- **Anon column grant** — mirrors existing `tools`/`mediums` pattern.
- **Freeform strings** — accepted for v1 per spec (descriptive, non-matching).
