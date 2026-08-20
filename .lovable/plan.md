# Simplify the age gate to an 18+ attestation

Workshop stops collecting birthdays. Instead, every account confirms once: "I confirm that I am 18 or older." Events can still say All Ages / 18+ / 21+ — those are venue rules, verified with ID in person.

## What changes for members

- The first-run age screen becomes a single required checkbox instead of a date-of-birth picker.
- The same checkbox appears alongside the terms/privacy line on the signup surfaces (signup page, join modal, RSVP auth sheet) so people confirm as they create an account.
- Members who already gave a birth date that proves they are 18+ are auto-confirmed and never asked again. Anyone else sees the checkbox once.
- The date-of-birth field disappears from profile editing; Settings shows a simple "18+ confirmed" status instead of the stored date.
- Event pages keep showing their age requirement (All Ages / 18+ / 21+) near the logistics, with a short note that the venue verifies ID.

## Backend (requires a database migration)

Applied via one migration, already drafted:

- `public.profiles` gains `adult_attested_at` (timestamptz). Backfill stamps it for every existing profile whose birth date proves 18+.
- `public.is_adult(uuid)` now returns true when `adult_attested_at` is set, or when a legacy birth date proves 18+.
- `reserve_event_rsvp` no longer reads a birth date. When an event has a minimum age it requires `is_adult()`; venue-level 21+ stays a display + door-check rule.
- `tg_workshop_applications_age_gate` uses `is_adult()` instead of birth-date math.
- `birthdate` column and its lock trigger stay in place for records already collected; nothing new writes to it.

## Code changes

- `src/lib/profile-age.functions.ts`: add `confirmAdultAttestation` (server-authoritative stamp, idempotent); `getMyAgeFields` returns `adultConfirmed` instead of exposing the date as the gate; retire `setMyBirthdate`.
- `src/lib/account-lifecycle.functions.ts`: facts return `adultConfirmed` (attested OR legacy 18+ birth date).
- `src/lib/account-lifecycle-state.ts` (+ its unit test): rename `hasBirthdate` → `adultConfirmed`; `age_required` triggers on missing attestation. `underage_removal` remains for self-declared minors who decline.
- `src/components/account-lifecycle/provider.tsx`: `submitBirthdate` → `confirmAdult()`.
- `src/components/account-lifecycle/gate.tsx`: `AgeStage` becomes a checkbox + Continue, with a "not 18" path to the existing removal stage.
- `src/routes/signup.tsx`, `src/components/signup-gate-modal.tsx`, `src/components/event-rsvp-auth-sheet.tsx`: required 18+ checkbox next to terms; stamp attestation right after signup.
- `src/routes/me.edit.tsx`: remove the DOB field and its save path.
- `src/routes/settings.tsx`: replace the birth-date row with attestation status; keep the personal age filter only where it still applies.
- Event display: confirm `min_age` / `age_policy_note` render near logistics on the event route and card.

Note: the migration runs only after you approve it in build mode.
