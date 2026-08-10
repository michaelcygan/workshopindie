# Apply to Workshop Independent — standardize and tighten the form

Four changes to `/applypodcast`: structured data where it should be structured, a tighter layout, a new optional Workshop URL field, and an opt-in that sends applicants into signup with their details prefilled.

## 1. Standardize the data we collect

**Location** — replace the free-text "Where you're based" input with the same location picker used in Collab authoring and Settings, so podcast applications store the same city identity as the rest of Workshop. Because applicants may be signed out, the picker searches worldwide (public search) but does not provision new localities; a match to an existing Workshop city stores the city record, anything else stores the place label as typed. Format shown to the applicant stays "Chicago, IL" style, identical to other surfaces.

**Specialization** — becomes a suggestion combobox driven by the chosen Field, using Workshop's existing format vocabulary (e.g. Film & Video suggests Documentary, Short Film, Editing). Free text is still allowed for anything not listed, so nobody is boxed in, but common answers land on consistent values we can group in admin.

**Portfolio URL** — already normalized on blur and server-side; unchanged.

**Workshop URL (new, optional)** — a field for an existing Workshop profile. Accepts a full `workshopindie.com/username` URL or a bare username; both are normalized down to the username and stored. If it matches a real Workshop profile, admin shows the linked account.

## 2. Tighter layout

Same page and copy, less scrolling:
- Reduce vertical rhythm between fields and reduce the top hero padding.
- Pair more fields two-up on desktop: Link to your work / Workshop URL, Social handle / Location.
- Shorter textareas (process drops from 7 rows to 5; the two optional ones to 3) — they still auto-scroll.
- Move the field label and its "Optional" tag onto one tight line and reduce the hint text spacing.
- No fields removed, no copy changes.

## 3. "Create a Workshop account" checkbox

New optional, unchecked checkbox above the marketing opt-in: "Also create my Workshop account."

Behavior on submit: the application saves first, exactly as it does today. If the box is checked, the applicant is sent to the existing signup page with name, email, and social handle prefilled and the application marked as its origin. If they never finish signup, the application is still recorded — nothing is lost. If they're already signed in, the checkbox isn't shown.

## 4. Admin

`/admin/podcast` picks up the new fields: Workshop URL (linked when it resolves to a real profile), the structured city, and whether the applicant asked to create an account. Location becomes usable as a grouping in the list.

## Technical notes

- Migration adds to `podcast_applications`: `city_id` (nullable reference to `cities`), `city` retained as the display label, `workshop_username` (nullable, normalized), `wants_account` (boolean, default false). Additive only; existing rows unaffected.
- The page uses `GlobalLocationCombobox` + the public `searchLocations` server fn directly (not `AuthoringLocationPicker`, which provisions and requires auth) so signed-out applicants work.
- Specialization suggestions come from `FORMAT_SUGGESTIONS` in `src/lib/taxonomy.ts`, keyed off the selected field.
- Workshop URL normalization reuses `src/lib/url-normalize.ts` plus username rules from `src/lib/usernames.ts`; validated in the existing Zod schema in `src/lib/podcast.functions.ts`.
- Account redirect uses the existing `/signup` search params (`email`, `first`, `last`, `ig`, `from`) — no new auth surface.
- Files touched: `src/routes/applypodcast.tsx`, `src/lib/podcast.functions.ts`, `src/routes/admin.podcast.tsx`, one migration.

## QA

Signed-out and signed-in submission; location picked from an existing Workshop city vs. a new place vs. left blank; specialization from suggestions vs. free text; Workshop URL as full URL, bare username, and invalid; account checkbox on/off (application saved either way, prefill correct); marketing opt-in unchanged; mobile layout at the tighter spacing; admin detail sheet shows all new fields.
