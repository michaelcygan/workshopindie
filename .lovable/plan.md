## Goal

Workshop becomes an 18+ product. Existing infra already has a `profiles.birthdate` column with a 13+ floor and a "lock once set" trigger — we lift the floor to 18, require DOB at signup, and force unverified existing users through a one-time DOB modal on next login. Public browsing stays open.

## What changes

### 1. Database — raise the floor to 18

Single migration:

- Update `tg_profiles_birthdate_guard()` so the floor is **18 years** (was 13). Keep the "locked once set" rule and the 1900 lower bound.
- Add `public.is_adult(uuid) → boolean` security-definer helper (returns true only if the user has a birthdate ≥18). Reused by RLS / app checks.
- Backfill safety: leave existing `birthdate` rows untouched. Any row that's already <18 stays valid in the DB but gets caught at the app layer (modal will soft-delete them).

No new tables. No grants beyond what `profiles` already has.

### 2. Signup — DOB is required

On `/signup` (email/password and Google):

- Add a **date-of-birth field** (shadcn DatePicker, year-first navigation, max date = today − 18 years so under-18 can't even pick a valid value).
- Microcopy: *"Workshop is an 18+ product. By signing up you confirm you're at least 18 years old."*
- On submit, call `setMyBirthdate` immediately after the Supabase signup call. If the trigger rejects (under-18), delete the just-created session, show *"Workshop is 18+. We can't create your account."* and clear the form.
- Google flow: the DOB step runs on the post-OAuth `/onboarding` page (already exists) — make the DOB field required there with the same trigger handling.

### 3. Existing accounts — forced DOB modal

A new global `<AgeGate />` mounts in `__root.tsx` (after `<AuthProvider>`):

- Renders nothing for signed-out users (public surface stays clean).
- For signed-in users, calls `getMyAgeFields` once. If `birthdate` is null, opens a non-dismissible modal: *"One more thing — confirm your date of birth. Workshop is now 18+."*
- On submit:
  - **≥18** → calls `setMyBirthdate`, modal closes, app continues normally.
  - **<18** → modal swaps to a friendly under-18 state: *"Workshop is 18+. Your account will be removed. Your data won't be shared."* with a single button that calls a new `requestAccountDeletion()` server fn (soft-delete: marks profile `deletion_requested_at = now()`, signs the user out, redirects to a public `/goodbye` page explaining the 30-day reversal window).
- Modal blocks `<main>` interaction via a backdrop; no escape to other routes.

### 4. Account deletion plumbing

Reuse what's there if a soft-delete column exists; otherwise add `profiles.deletion_requested_at timestamptz` in the same migration as #1. A scheduled job that hard-deletes after 30 days is out of scope for this turn (mention in follow-ups).

### 5. Surface copy

- Signup page footer line: *"Workshop is 18+."*
- Site footer (`top-nav` / `mobile-nav` footer area): small "18+" badge next to the copyright.
- `/llms.txt`: add a one-liner under the intro — *"Workshop is an 18+ product; account creation requires age attestation."*
- Terms page (if one exists — verify during build): add an "Age" clause. If none exists, surface it only in the signup microcopy for now.

### 6. Out of scope (deliberately)

- No content-flagging / NSFW toggle on Works (the whole point of going 18+ is avoiding that work).
- No public-page interstitial — public browsing stays open for SEO and conversion.
- No DOB on third-party login providers beyond what `/onboarding` already collects.
- No hard delete cron — that's a follow-up turn.

## Files touched

- **New migration** — raise birthdate guard to 18, add `is_adult()`, add `deletion_requested_at` if missing.
- **New** `src/components/age-gate.tsx` — the modal + soft-delete CTA.
- **New** `src/lib/account-deletion.functions.ts` — `requestAccountDeletion()` server fn.
- **New** `src/routes/goodbye.tsx` — post-deletion landing page.
- **Edit** `src/routes/__root.tsx` — mount `<AgeGate />`.
- **Edit** `src/routes/signup.tsx` — required DOB field + 18+ microcopy + rejection flow.
- **Edit** `src/routes/onboarding.tsx` — make DOB required for OAuth signups, same rejection flow.
- **Edit** `public/llms.txt` — add the 18+ line.
- **Edit** `src/components/top-nav.tsx` (or wherever the footer lives) — small 18+ badge.

## Open follow-ups for later turns

- Hard-delete cron after 30 days.
- Audit RLS policies that should use `is_adult()` if you ever loosen the floor again.
- "Forgot your DOB?" support path (currently locked once set; admins can override via SQL).
