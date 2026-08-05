# Account lifecycle: one shared first-run for every sign-in path

## What's broken today (confirmed in the code)

- `AgeGate` skips itself when `needsOnboarding()` is true, and `WelcomeTour` only opens when `profiles.onboarded` is true. A brand-new Google/Apple account has `birthdate = null`, `onboarded = false`, `tour_completed_at = null`, so **neither** opens. The user is signed in on the homepage with nothing to do.
- Google/Apple do a full page redirect back to `window.location.origin` (or a raw `redirect` path). The component that called `resolvePostAuthPath()` no longer exists after that redirect, so post-auth routing never runs.
- `WelcomeTour` reads `sessionStorage["ws.welcome_open"]` in an effect keyed on `user`/`loading`, which usually doesn't re-run on the navigation from `/onboarding`.
- Redirect validation is duplicated in `login.tsx`, `signup.tsx`, `google-sign-in.tsx`, `apple-sign-in.tsx` as `startsWith("/") && !startsWith("//")` — inconsistent, and `login.tsx`'s manual path accepts a bare `startsWith("/")` value.
- Pending actions (`ws.pendingGroupJoin`, `workshop:pending_rsvp`, `signup-ref`) fire on `SIGNED_IN`, before age/welcome are resolved, from a `SignOutCacheReset` component that also clears the query cache.

No new database columns are needed: `birthdate`, `tour_completed_at`, `onboarded` already express the three independent states. **No migration is planned.**

## The state machine

One provider derives exactly one state from one authenticated query keyed by user id:

```text
signed_out → loading → load_error
                     → age_required → welcome_required → ready
                     → underage_removal
```

Order is enforced: age always resolves before welcome. Only one overlay renders. `onboarded` never influences the gate; it keeps meaning "public profile completed."

## Waves

### Wave 1 — Lifecycle foundation
- Add `src/lib/account-lifecycle.functions.ts`: authenticated server fns returning `{ hasBirthdate, welcomeCompleted, profileCompleted, profileExists }` (no raw birthdate), plus `completeWelcome()` and an idempotent `ensureProfileRow()` repair.
- Add `src/lib/account-lifecycle-state.ts`: pure `deriveLifecycleState(input)` — unit-testable, no React.
- Add `src/components/account-lifecycle/` — provider (`useAccountLifecycle`), gate, age stage, welcome stage, underage stage, load-error stage (Retry + Sign out, bounded auto-retry with backoff).
- Mount once in `__root.tsx` inside `AuthProvider`; delete `AgeGate` and `WelcomeTour` mounts.
- Age stage: min date 1900-01-01, max today; the DB 18+ trigger decides; rejection → `underage_removal` (existing deletion + sign-out + `/goodbye` preserved). Not dismissible by backdrop/Escape.
- Fix the stale "13+" comment in `profile-age.functions.ts`.
- Tests: the 10-row lifecycle truth table.

### Wave 2 — Unified auth return
- Add `src/lib/safe-destination.ts`: one validator rejecting absolute URLs, `//`, backslash tricks, control chars, bad encodings, cross-origin resolution; keeps same-origin path+query+hash; empty/malformed → `/`.
- Add `src/routes/auth.complete.tsx`: quiet loading state, waits for auth to settle, resolves lifecycle, routes to member home when lifecycle work is pending or to the validated pending destination when ready; timeout → retryable error. Never logs tokens.
- Add `src/lib/auth-launcher.ts`: app-owned wrapper over `lovable.auth.signInWithOAuth` (the generated `src/integrations/lovable/index.ts` is untouched) that persists intent, then uses `/auth/complete` as `redirect_uri`. If the SDK misbehaves with a dedicated callback route, fall back to origin as callback and keep orchestration in the root coordinator.
- `google-sign-in.tsx` / `apple-sign-in.tsx` / `login.tsx` / `signup.tsx` use the launcher + validator; login's open-redirect hole closes.
- Email signup: navigate through the shared flow when `signUp` returns a session; show "check your email" only when confirmation is actually required. Confirmation links land on `/auth/complete`.
- Tests: safe-destination table (accept `/groups`, `/me/blog?draft=1`, `/works/new#publish`; reject `//evil.example`, `https://evil.example`, `/\evil.example`, encoded tricks).

### Wave 3 — Durable intents
- Add `src/lib/post-auth-intent.ts`: versioned, sessionStorage-backed intent `{ v, kind, payload, returnTo, createdAt, expiresAt }`; kinds for route return, RSVP, seed-link join, group join, follow, like/save work, workshop invite, collab claim. Reads legacy `ws.pendingGroupJoin`, `workshop:pending_rsvp`, `signup-ref` during migration.
- Consumption happens only at `ready`, once (Strict-Mode safe), idempotent, retained on recoverable failure, cleared on success or sign-out, never run for a different user id.
- Split `SignOutCacheReset` into cache-clearing only; move seed-link/RSVP/referral execution into a lifecycle-ready `PostAuthIntentRunner`. Referral attribution moves out of `/onboarding` into this runner.
- Update `signup-gate-modal.tsx`, `event-rsvp-auth-sheet.tsx`, follow/join/like/save buttons, `w.$token`, collab claim to persist intent before auth and stop mutating on bare `user` presence.
- Tests: intent serialize/parse/expiry/unsafe-path/single-consume/user-mismatch.

### Wave 4 — Welcome dialog and profile handoff
- Welcome dialog (replacing `welcome-tour.tsx`): eyebrow "Welcome to Workshop", heading "Make something. Find your people.", four actions — Build your profile (`/me/edit?next=/works/new`), Find a Group (`/groups`), Write a post (`/me/blog`), Post a Collab (`/collab/new`) — plus quiet "Explore Workshop". No "Step 2 of 2", no carousel. Two-column on desktop, vertical sheet on mobile, existing tokens only.
- Persist `tour_completed_at` **before** navigating; failure keeps the dialog open with a retry. Backdrop click does not complete. `ws.welcome_open` and `ws.first_run_hint` forcing removed.
- `/me/edit` accepts a validated `next`, honored only after a successful save.
- Remove birthdate collection from `signup.tsx`; `/onboarding` becomes an optional focused profile route (or safe redirect to `/me/edit` once ready) — no longer the automatic post-auth destination. `/me` sends incomplete profiles to the editor. `claimAutoUsername` behavior preserved.
- `ProfileCompletionChip` dismissal key becomes user-scoped.
- Tests: age not dismissible, adult DOB → welcome, underage → removal, failed saves don't advance, explore persists, user switch resets state, ready user sees nothing.

### Wave 5 — Hardening
- `npm test`, `npm run lint`, `npm run build` after every wave; fix new failures before continuing.
- Diff review for duplicate listeners, dead code, stale comments.
- Manual acceptance matrix on the preview for email + embedded surfaces; Google/Apple reported separately as requiring real provider accounts (I can only verify mocked paths).

## Files expected to change

Add: `src/lib/account-lifecycle.functions.ts`, `src/lib/account-lifecycle-state.ts` (+test), `src/lib/safe-destination.ts` (+test), `src/lib/post-auth-intent.ts` (+test), `src/lib/auth-launcher.ts`, `src/routes/auth.complete.tsx`, `src/components/account-lifecycle/*` (+tests).

Modify: `src/routes/__root.tsx`, `login.tsx`, `signup.tsx`, `onboarding.tsx`, `me.edit.tsx`, `me.index.tsx`, `w.$token.tsx`, collab claim route, `google-sign-in.tsx`, `apple-sign-in.tsx`, `signup-gate-modal.tsx`, `event-rsvp-auth-sheet.tsx`, follow/join/work-action components, `use-pending-rsvp.ts`, `profile-completion-chip.tsx`, `post-auth-destination.ts`, `profile-age.functions.ts` (comment only).

Remove after replacement: `src/components/age-gate.tsx`, `src/components/welcome-tour.tsx`, `first-run-hint` forcing path.

Untouched: generated integration/client/routeTree files, homepage and navigation design, auth provider configuration, RLS and grants, database schema.

## Open question

If the Lovable auth SDK cannot round-trip through `/auth/complete` reliably in the preview iframe, Wave 2 keeps the origin as the provider callback and puts all orchestration in the root coordinator — same behavior, one less route.
