# Finish age + identity rollout

The DB, server functions, and `/me/edit` are done. This plan covers the remaining four surfaces.

## 1. Onboarding (`src/routes/onboarding.tsx`)
- Replace single "display name" input with **First name** (required) + **Last name** (required).
- Add **Date of birth** picker (required, 13+ enforced server-side by the existing birthdate guard trigger).
- Derive `display_name` via `deriveDisplayName(first, last)` on submit — no manual override at onboarding (keep it simple; override lives in `/me/edit`).
- Helper copy under DOB: "Private. Used only for age filters you choose to apply. Never shown on your profile."
- Save birthdate through `setMyBirthdate` server fn (bypasses RLS column restriction).

## 2. Workshop create (`src/routes/workshops.new.tsx`)
- Add an **Age scope** field group with radio options:
  - All ages (default) → `min_age = null, max_age = null`
  - 18+ → `min_age = 18`
  - 21+ → `min_age = 21`
  - Custom → two number inputs for min/max
- Add a **"Hide from users outside this range"** checkbox → `hide_from_ineligible`.
- Persist to the new `workshops.min_age` / `max_age` / `hide_from_ineligible` columns.

## 3. Workshop detail (`src/routes/workshops.$slug.tsx`)
- Show a small chip near the title when `min_age` or `max_age` is set (e.g. "18+", "21+", "18–25"). Not loud.
- The age-gate trigger on `workshop_applications` already blocks ineligible applies server-side. Catch that error in the apply handler and show a friendly inline message: "This workshop is limited to ages X+. Update your birthdate in Settings if this is incorrect."

## 4. Workshop feed (`src/routes/workshops.index.tsx`)
- Read `profiles.age_filter_min` for the signed-in user (already exposed via `getMyAgeFields`).
- If set (18 or 21), filter the feed query: exclude workshops where `max_age IS NOT NULL AND max_age < age_filter_min` (i.e. don't show teen-only rooms to a user who opted into 18+/21+ only).
- Also honor host's `hide_from_ineligible`: exclude workshops where the viewer's actual age falls outside `[min_age, max_age]` AND `hide_from_ineligible = true`. Use `has_min_age()` / `user_age()` via a server fn helper to avoid leaking birthdate.
- No UI toggle here — the preference lives in `/me/edit` → Privacy (already built). Keep it invisible per user's "not super noticeable" requirement.

## Technical notes
- New server fn `getFeedAgeContext()` (returns `{ ageFilterMin, userAge }` for the caller) so the feed query can filter without exposing birthdate.
- `onboarding.tsx` and `workshops.new.tsx` use shadcn Calendar/Popover per the datepicker pattern.
- No new migrations; all schema is already in place.

## Out of scope
- ID verification, public age display, age gates on cities/collabs/DMs, fancy date picker, teen-only filter chips.
