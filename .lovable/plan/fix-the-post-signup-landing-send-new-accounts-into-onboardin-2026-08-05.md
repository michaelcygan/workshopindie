# Fix the post-signup landing: send new accounts into onboarding

## What's happening

Accounts are being created now (Google and Apple both work). Two things are still wrong after that:

1. **You land back on the sign-in / sign-up page.** The Google and Apple buttons return the browser to the page you started from, and `/login` and `/signup` have no rule that says "if you're already signed in, leave". So a successful sign-in leaves you staring at the form you just used — it looks like nothing happened.
2. **Social signups never reach onboarding.** The onboarding flow at `/onboarding` (name, date of birth, home city, what you make, suggested groups) is only entered from the email signup form. Google/Apple users skip it entirely, so they have no city, no handle, no profile — and the 18+ age modal fires instead, because the birthdate onboarding would have collected was never asked for. That's the age prompt you saw on both accounts.

## The fix

**1. Signed-in users never sit on an auth page.**
`/login` and `/signup` get a redirect: if a session exists, leave immediately — to `/onboarding` if the profile isn't onboarded yet, otherwise to the intended destination (`?redirect=`) or the homepage.

**2. One shared "where does this person go next?" decision.**
A small helper reads the signed-in user's profile once and answers: not onboarded → `/onboarding`; onboarded → home or the saved destination. Used by the auth pages and by the post-OAuth return so Google, Apple, and email all behave identically.

**3. Route OAuth returns through that decision.**
The Google/Apple buttons already return to a same-origin URL. On return, the app resolves the destination above instead of dumping the user on whatever page they started from. Any saved destination (event RSVP, group invite, collab claim) still wins over onboarding — those flows already stash their target, and onboarding can be finished afterwards.

**4. Stop the age modal from double-asking new users.**
The age gate stays as the enforcement backstop for existing accounts, but it will not show while the user is in onboarding or hasn't completed it — onboarding already asks for date of birth as a required field. Existing users without a birthdate are unaffected and still get the modal.

## Technical notes

- New helper (e.g. `src/lib/post-auth-destination.ts`) reading `profiles.onboarded` for the current user; single source of truth for both auth routes and the OAuth return path.
- `src/routes/login.tsx` and `src/routes/signup.tsx`: add a client-side effect/guard that navigates away when `useAuth()` reports a session, honoring the existing `claim` / `join`+`group` / `redirect` search params before falling back to the destination helper.
- `src/components/google-sign-in.tsx` and `src/components/apple-sign-in.tsx`: keep `redirect_uri` as a public same-origin URL; the inline (non-redirected) branch resolves the destination instead of `window.location.assign(safeRedirect ?? "/")`.
- `src/components/age-gate.tsx`: skip rendering when the profile is not yet `onboarded`, or when the current route is `/onboarding`.
- No database changes required.

## Verification

- Sign up fresh with Google → lands on `/onboarding`, no age modal, completes to the homepage with the welcome state.
- Same with Apple, and with email signup (unchanged path).
- Sign in with an existing, onboarded account from `/login` → goes to the homepage, never back to the form.
- Sign in from an event RSVP or group invite link → still returns to that event/group.
