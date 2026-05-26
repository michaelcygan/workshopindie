# Names + birthday + opt-in age filters (v2: all-ages)

Two related changes: clean up confusing name fields, and quietly capture a birthday so users can opt into age-range filters without making the platform feel age-gated. Everyone 13+ is welcome; age becomes a quiet two-way filter, not a gate.

## Part 1 — Names

Today there are three overlapping fields (Display name, First name, Last name) and signup already sets `display_name = "${first} ${last}"`. Confusing.

New model:
- **First name + Last name** become canonical and **required** in onboarding and `/me/edit`. They power the "Jane S." trust signal already used on signup.
- **Display name** becomes an **auto-derived field with an optional override**. Collapsed by default behind a small "Use a different display name" toggle. When off (default), the field shows a disabled preview of `${first} ${last}` and saves that value. When on, the field becomes editable and the override is what gets saved.
- Existing users whose `display_name` already differs from `${first} ${last}` get the toggle pre-flipped to "on" so we never silently overwrite their chosen name.
- Username (handle) stays unchanged — separate concern.
- Onboarding gets the same first/last pair (replacing today's single "Display name" input), with the trust-signal helper copy.
- `src/lib/display-name.ts` gains `deriveDisplayName(first, last, override)` used by both edit and onboarding.

## Part 2 — Birthday + opt-in age filters

Goal: enable 18+/21+ networking for people who want it, **without** turning the platform into a gated space or making younger users feel second-class.

### Floors

- **Platform floor: 13+** (COPPA-aligned; standard for general-audience social platforms). Under-13s are blocked at signup with a friendly "Workshop is for ages 13 and up — come back soon."
- No platform-wide 18+ requirement. Teens get the full platform by default, minus age-restricted workshops.

### Collection

- **Onboarding**: required "Date of birth" field. Helper copy: "Private. Used only for age filters you choose to apply. Never shown on your profile." Validates 13+.
- **`/me/edit` → Identity section**: editable, then **locked once set** (with "Contact support to change" affordance — prevents gaming age filters; we can soften later).
- **Signup**: not added — keep signup short. Collected in onboarding.
- **Existing users without birthdate**: shown an inline prompt next time they visit `/me/edit` or try to interact with an age-scoped workshop. Not a blocking modal — they can keep using the platform; they just can't apply to age-restricted workshops until they add it.

### Where age is used

**Workshops (host-side):**
- Hosts can optionally set an **age scope** on a workshop: `All ages` (default), `18+`, `21+`, or `Custom min/max`.
- Apply/join server fn checks the applicant's birthdate against the scope. Ineligible users get a friendly inline message ("This workshop is 21+. Browse other sessions →") — no shaming, no hard wall.
- Optional host toggle: "Hide from users outside this range" → workshop is filtered out of feeds for ineligible users. Default off (still visible, with a small `21+` chip).

**Workshops (attendee-side):**
- Personal opt-in filter in the workshops feed filter sheet: "Only show me 18+ / 21+ workshops." Off by default. Saved to `profiles.age_filter_min`. Available to everyone — a 17-year-old can also filter to "13–17 only" once we add that tier, but the v1 chips are just **18+** and **21+** for adults.

**Groups (future):**
- Same `min_age` / `max_age` shape reused when non-city group kinds land. Cities themselves stay all-ages.

**Everywhere else:**
- No age affordance on DMs, collabs, feed, comments, gallery, etc. Age only ever shows up as a workshop chip and as a filter the user opts into.

### Privacy posture

- Birthdate is never returned by any public-profile or peer-visible query.
- RLS keeps profile rows publicly readable (existing pattern), but **`birthdate` is excluded from every public select** in `u.$username.tsx` and any other read path that surfaces other users' profile data.
- Eligibility checks run server-side via a `has_min_age(user_id uuid, min int) returns boolean` security-definer function. Server functions call it; clients never see a raw birthdate other than their own.
- No public "X years old" anywhere. Ever.

## Technical notes

### DB migration

Add to `profiles`:
- `birthdate date` — nullable for backfill; required for new signups via app logic.
- `age_filter_min smallint` — user's personal "only show me X+" workshops preference. Nullable = no filter.

Add to `workshops`:
- `min_age smallint` nullable
- `max_age smallint` nullable
- `hide_from_ineligible boolean default false`

New helpers:
- `has_min_age(user_id uuid, min int)` security-definer function.
- Reuse existing trigger pattern (no CHECK constraints — date math isn't immutable).

### Server functions

- Workshop apply/join: add eligibility check before insert. Return a typed error the UI renders as a friendly inline message.
- Workshop feed query: when caller has `hide_from_ineligible` workshops to exclude, filter via the security-definer helper.
- Profile update: enforce 13+ on birthdate; once set, reject changes unless caller is admin.

### UI changes

- `src/routes/me.edit.tsx` — Identity section: first/last required, display-name override pattern, birthdate (locked once set).
- `src/routes/onboarding.tsx` — replace single "Display name" with first/last; add birthdate (13+).
- `src/routes/workshops.new.tsx` — optional "Age scope" group (All ages / 18+ / 21+ / Custom) + "Hide from users outside this range" toggle.
- `src/routes/workshops.$slug.tsx` — small age chip when restricted; eligibility error in the apply flow.
- `src/routes/workshops.index.tsx` (or wherever filters live) — "Only 18+ / 21+" chip in the filter sheet, persisted to `age_filter_min`.
- `src/lib/display-name.ts` — `deriveDisplayName()` helper.

## Out of scope

- ID verification — self-reported, like most platforms.
- Showing age publicly on profiles.
- Age restrictions on cities, collabs, DMs, feed, or content discovery.
- Country-specific legal-age handling beyond the flat 13+ floor.
- Teen-only spaces beyond the existing filter mechanism (can layer later).
- Drag-and-drop / fancy date picker — native date input is fine.

## Confirm before I build

1. **13+ floor** OK? (COPPA-aligned, matches Instagram / TikTok / Discord.)
2. **Birthdate locked once set** (contact support to change) OK? — keeps age filters honest. Alternative: allow self-edit, accept some gaming.
3. **v1 filter chips = 18+ and 21+ only** OK? — simplest. We can add 13–17, 25+, etc. later.
