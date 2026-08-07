# One door for sign in and sign up

Today the two forms are dead ends: entering an email that has no account on the sign-in form just shows "Invalid login credentials", and entering an email that already has an account on the signup form shows "User already registered". Both should quietly hand the person to the right flow instead.

## Behavior

**Sign in with no account**
- Wrong password on an existing account: unchanged — "That password doesn't match" with the Forgot link.
- Email has no account: send the person to the signup form with the email (and any redirect/join/claim context) already filled in, plus a short note: "No account yet — let's make one." The typed password carries over in memory so they only add their name.

**Sign up with an existing account**
- If the typed password matches the existing account: sign them in immediately and continue to wherever they were headed. No error shown.
- If it doesn't match: send them to the sign-in form with the email prefilled and a note: "You already have an account — sign in." Forgot-password is one tap away.

Google/Apple already behave this way (one identity, no duplicate account), so nothing changes there.

## Technical notes

- New server function `checkEmailExists` (POST) in a client-safe module, using the admin client loaded inside the handler, returning only `{ exists: boolean }`. It runs only after a failed credential attempt, is throttled per IP/email in-memory-free (short-lived DB or simple time-window guard on the client plus server-side cheap lookup), and never reveals anything beyond existence — this is the standard trade-off required to route the user correctly.
- Sign-in submit: on `Invalid login credentials`, call `checkEmailExists`. `false` → `navigate({ to: "/signup", search: { ...currentSearch, email } })` and stash the typed password in `sessionStorage` under a one-shot key that signup reads and clears.
- Signup submit: on Supabase's already-registered signal (explicit error, or `data.user` with an empty `identities` array when confirmation obfuscation is on), immediately attempt `supabase.auth.signInWithPassword` with the same email/password. Success → existing `AUTH_CALLBACK_PATH` handoff. Failure → `navigate({ to: "/login", search: { ...currentSearch, email } })` with a toast.
- `/login` gains an `email` search param so it can prefill, mirroring signup's existing one.
- Post-auth intent (`claim`, `join`/`group`, `redirect`) is set before every handoff so the destination survives the cross-flow bounce; all existing search params carry across both directions.
- No changes to the OAuth path, `auth-launcher.ts`, or the account lifecycle coordinator.
