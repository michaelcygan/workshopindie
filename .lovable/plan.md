## Goal

Simplify identity on `/me/edit` and signup to **First name + Last name only** (no custom display name field). Add an optional **Artist aliases** list (e.g. music name, DJ name, real name) that shows on the public profile.

## 1. Database (migration)

- Add `profiles.aliases text[] not null default '{}'` with a length cap (max 5 aliases, each 1–40 chars) enforced via a CHECK constraint.
- Keep `display_name` column as-is — it stays the canonical "name" used across the app, but is now always derived from `first_name + last_name` on write. No UI override anymore.

## 2. `/me/edit` (`src/routes/me.edit.tsx`)

- Remove the entire "Display name" card (label, "Use a different name" checkbox, custom override input, derived preview input).
- Remove `displayNameOverride` and `useDisplayOverride` from `FormState` and `EMPTY`.
- On save: always write `display_name = `${first} ${last}`.trim()` (drop the `deriveDisplayName(..., override)` path).
- Add a new **"Artist aliases (optional)"** subsection inside the Identity section, just below the name row. UI: vertical list of pill rows with an `Input` per alias + remove (X) button, plus a small "+ Add alias" button. Cap at 5. Helper copy: "Other names you go by — stage name, DJ name, real name. Shown as small chips on your profile."
- Hydrate `aliases` from the loaded profile; persist on submit (trim, dedupe case-insensitively, drop empties).

## 3. `/signup` (`src/routes/signup.tsx`)

- Already collects First/Last and sets `display_name` from them via user metadata — leave as-is. No alias UI at signup (keep it minimal).

## 4. Onboarding (`src/routes/onboarding.tsx`)

- Already uses `deriveDisplayName(first, last)` (no override) — no changes needed.

## 5. Public profile (`src/routes/u.$username.tsx`)

- Add `aliases` to the profile select.
- Render aliases as small muted chips directly under the name / headline area in the profile header (`also known as: <chip> <chip>`). Skip the row when empty.
- No changes to credits/cards.

## 6. `display-name.ts` helper

- Keep `deriveDisplayName` for the rare onboarding path but stop using its `override` arg in `/me/edit`. No deletion to avoid touching unrelated call sites.

## Out of scope

- Searching by alias, alias verification, alias-as-handle, showing aliases anywhere outside the public profile header, or migrating existing custom `display_name` values (users with a previously-customized display name will see it overwritten to `${first} ${last}` next time they save — acceptable for this cleanup).

## Technical notes

- One migration, one server-trivial change (profile update payload). All other changes are presentational.
- No RLS changes; `aliases` is part of the public profile read.
