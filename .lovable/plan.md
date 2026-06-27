# Fix profile redirect + tighten onboarding

## The bug (note #2)

`/me/index.tsx` redirects to `/onboarding` whenever `!profile.onboarded || !profile.username`. The onboarding form sets `onboarded: true` but **never assigns a username**, so every new user gets bounced back to "Create your profile" forever when they click Profile in the dropdown.

## Fix: auto-mint a username at onboarding completion

Add a `claimAutoUsername` server function (in `src/lib/account.functions.ts`) that:

1. Slugifies `first + last` → `janedoe`.
2. If taken, appends a short random suffix (`janedoe7k`, retry up to 5x).
3. Updates `profiles.username` for the calling user (only if currently NULL — never overwrites a user-chosen handle).
4. Returns the username string.

Call it from `src/routes/onboarding.tsx` `onSubmit` **before** flipping `onboarded: true`, and again as a safety net from `/me/index.tsx` if a stale account lands there without a username (one-time backfill, then redirect to `/u/$username`).

Users can still rename their handle later in `/me/edit` — same validation as today.

## Holistic onboarding pass (note #3)

The end-to-end flow today is: **Signup → email confirm → Onboarding step 1 (basics) → Onboarding step 2 (Groups) → Home (with welcome tour flag) → ProfileCompletionChip nags on home**. It works but it's piecemeal and asks the same questions twice.

### Distillation

**A. Merge "name + DOB" into the signup screen and "city + mediums" into onboarding step 1.**
Today `/signup` already collects first name, last name, DOB. `/onboarding` re-asks for first name + last name + DOB. Drop the duplicate fields from onboarding — pre-fill from `user_metadata` and just show city + mediums + optional bio.

**B. Kill the "step 1 of 2" framing; make Groups feel like a reward, not a chore.**
After basics save, show a single celebratory screen: *"You're in. Pick a few Groups to fill your feed (optional)."* with a Skip → Home button that's just as prominent as "Continue".

**C. Auto-username (above) means /me works immediately** after step 1, so a user who skips Groups can still click Profile and land on their real page.

**D. Welcome tour trigger** stays as-is (`ws.welcome_open` sessionStorage), but only fires when the user lands on `/` from onboarding — not after Groups skip back-navigation.

**E. ProfileCompletionChip** keeps nudging avatar + bio + first Work on the home page. That's the right place for ongoing nudges — onboarding itself stays short.

### Resulting flow

```text
/signup     → email + password + first + last + DOB + (optional IG)
              ↓ (auto-confirmed or email link)
/onboarding → home city (required) + mediums + short bio (optional)
              ↓ auto-mints username
Groups step → "Pick a few Groups" with equal-weight Skip
              ↓
/           → welcome tour overlay + ProfileCompletionChip for the rest
```

Net effect: 1 fewer duplicate screen, profile button works the moment basics are saved, and the "two-step" anxiety goes away.

## Technical changes

1. **`src/lib/account.functions.ts`** — add `claimAutoUsername` server fn (slugify, collision-retry, update only if null).
2. **`src/routes/onboarding.tsx`** —
   - Remove `firstName` / `lastName` / `birthdate` fields and the `setMyBirthdate` call (already collected at signup; if missing, redirect to signup-style mini-prompt).
   - Call `claimAutoUsername` before the `profiles.update`.
   - Simplify copy: drop "Step 1 of 2", reframe Groups step as optional.
3. **`src/routes/me.index.tsx`** — if `onboarded && !username`, call `claimAutoUsername` once then redirect to `/u/$username` (backfill for users stuck by the current bug).
4. **`src/components/onboarding-groups-step.tsx`** — make Skip button equal visual weight to Continue (no code logic change beyond styling).
5. **`src/routes/signup.tsx`** — no changes (already collects name + DOB).

No DB migration needed; `profiles.username` already exists and is nullable-unique.
