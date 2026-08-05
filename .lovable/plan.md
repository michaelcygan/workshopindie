# Account lifecycle: one shared first-run for every sign-in path

## Current state

Waves 1-3 are implemented and the lifecycle foundation is wired and tested:

- `src/lib/account-lifecycle-state.ts` and `.test.ts` derive states from `{ auth, query, facts, underage }` with a 10-row truth table.
- `src/lib/account-lifecycle.functions.ts` returns profile facts (no raw birthdate) and an idempotent `ensureProfileRow()` repair.
- `src/components/account-lifecycle/provider.tsx` and `gate.tsx` render `AgeStage`, `UnderageStage`, `WelcomeStage`, and `LoadErrorStage` as overlays over the signed-in app.
- `src/lib/safe-destination.ts` and `.test.ts` validate same-origin redirects, rejecting `//evil`, `https://evil`, backslashes, control chars, and malformed encodings.
- `src/lib/auth-launcher.ts` is the single wrapper for Google/Apple OAuth, persisting intent and using `/auth/complete` as the callback.
- `src/routes/auth.complete.tsx` is the unified provider return route that waits for auth and then routes to the member homepage.
- `src/lib/post-auth-intent.ts` is the versioned sessionStorage intent store with migration for the legacy `ws.pendingGroupJoin`, `workshop:pending_rsvp`, and `signup-ref` keys.
- `src/components/account-lifecycle/post-auth-runner.tsx` consumes intents only when the lifecycle reaches `ready`, and handles referral attribution once per user.

## Remaining cleanup (Wave 4)

Before the lifecycle is production-ready, the old first-run wiring still needs to be fully removed:

1. Remove `FirstRunHint` from `src/routes/__root.tsx` — the `ws.first_run_hint` forcing path is still rendered.
2. Remove birthdate collection from `src/routes/signup.tsx` — the manual email form still enforces an 18+ client-side check. After successful signup, the lifecycle gate's `AgeStage` will collect and verify the birthdate.
3. Update `src/routes/signup.tsx` so it no longer auto-redirects to `/onboarding`; it should hand off to the same `/auth/complete` path used by OAuth.
4. Convert `src/routes/onboarding.tsx` from a mandatory first-run destination into an optional profile-focus route (or a safe redirect to `/me/edit`). It currently still collects birthdate and runs referral attribution inline, both of which the new lifecycle now owns.
5. Make `src/routes/me.edit.tsx` honor a validated `next` search parameter and return there after a successful save.
6. Make `ProfileCompletionChip` dismissal user-scoped (`profile-completion-dismissed:${userId}`) instead of global.
7. Remove the inline seed-link/referral redemption from `src/routes/login.tsx` and `src/routes/signup.tsx`; the `PostAuthRunner` is the single place for these.
8. Refresh the Welcome stage to a lightweight, non-carousel dialog: heading "Make something. Find your people.", with clear actions to Build profile, Find a group, Write a post, Post a collab, and a quiet Explore option. Persist `tour_completed_at` before navigating.

## Verification

- `npm test` and `npm run lint` must pass after Wave 4 cleanup.
- Manual acceptance on the preview: email signup creates an account and immediately lands in the age stage; a valid DOB advances to the welcome stage; completing or dismissing the welcome stage shows the homepage; actions attempted before sign-in (RSVP, group join, follow) resume after the lifecycle is ready.
- Google/Apple flows are reported by the user; the agent can only verify the local mock paths and callback route.

## Files expected to change

Add: none remaining.

Modify: `src/routes/__root.tsx`, `src/routes/signup.tsx`, `src/routes/onboarding.tsx`, `src/routes/me.edit.tsx`, `src/routes/login.tsx`, `src/components/account-lifecycle/gate.tsx`, `src/components/profile-completion-chip.tsx`.

Remove after replacement: `src/components/first-run-hint.tsx` and its `__root.tsx` mount; the old `src/components/age-gate.tsx` and `src/components/welcome-tour.tsx` are already unmounted but may still be deletable.

Untouched: generated integration/client/routeTree files, database schema, RLS and grants, auth provider configuration.
