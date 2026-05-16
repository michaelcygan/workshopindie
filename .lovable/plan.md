## Goal

Collect **first name** and **last name** (required) and an **optional Instagram handle** at signup. The Workshop `@username` is no longer set during signup — users claim it later from their profile, so abandoned accounts don't squat handles.

The "real first name + last initial" can then be rendered anywhere we need a trust signal (e.g. "Jane S.").

## Changes

### 1. Database (migration)
Add to `public.profiles`:
- `first_name text`
- `last_name text`
- `instagram_handle text` (stored without the `@`, lowercase, with a CHECK for allowed characters; nullable)

Update the `handle_new_user()` trigger to also read `first_name`, `last_name`, `instagram_handle` from `raw_user_meta_data` and populate the new columns. `display_name` keeps falling back the same way (now also falls back to `first_name + ' ' + last_name`).

No backfill needed — existing rows stay null; the profile editor lets people add them.

### 2. Signup form (`src/routes/signup.tsx`)
Replace the single "Your name" field with:
- First name (required)
- Last name (required)
- Email, Password (unchanged)
- Instagram handle (optional, with a `@` prefix adornment, strip leading `@` and lowercase on input)

No username field here. Pass all of the above through `supabase.auth.signUp({ options: { data: { first_name, last_name, instagram_handle, display_name: `${first} ${last}` } } })`.

### 3. Onboarding (`src/routes/onboarding.tsx`)
Remove the username field from the onboarding step (it now belongs on the profile editor). Keep city, categories, bio. Display name is prefilled from `first_name + last_name`; user can edit.

### 4. Profile editor (`src/routes/me.edit.tsx`)
Add inputs for:
- First name, Last name (required)
- Instagram handle (optional, `@` prefix, same sanitisation)

Keep the existing Username input here — this is where users claim their `@handle`. Add a small hint: "Pick a username when you're ready — this is your public @handle."

### 5. Trust-layer helper
Add `src/lib/display-name.ts` exporting `trustName(profile)` → returns `"Jane S."` when both names exist, otherwise falls back to `display_name` or `username`. Not wired into UI in this pass — just the helper, ready for callers (workshops, collab, comments) to adopt as we go.

## Out of scope
- Changing existing username display anywhere
- Verifying Instagram handles actually exist
- Migrating existing single-field `display_name` into first/last (left for users to fill in)
