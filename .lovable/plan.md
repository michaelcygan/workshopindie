## Problem

On the Work detail page (`src/routes/works.$slug.tsx`), the "← Back" button is hardcoded to `navigate({ to: "/" })`. So navigating from Profile → Work → Back drops the user on Home instead of returning to the profile they came from. A few other surfaces have similar dead-end "Back" affordances (e.g., `settings.tsx` "Back to profile" always goes to `/`).

## Fix

Introduce a small `useSmartBack(fallback)` helper and swap the hardcoded back handlers to use it. Behavior:

1. If `window.history.length > 1` AND `document.referrer` is same-origin (or empty in SPA nav after an internal push), call `router.history.back()` — this restores scroll and preserves the prior route's state/search params.
2. Otherwise, navigate to the provided fallback (e.g., `/gallery` for works, `/me` for settings).

This matches user intent ("back = previous page") without breaking direct-link entries (opening a Work from an external link still gets a sensible fallback instead of a broken back stack).

### Files to change

- **New:** `src/hooks/use-smart-back.ts` — exports `useSmartBack(fallback: LinkOptions)` returning a `() => void` handler.
- **`src/routes/works.$slug.tsx`** — replace the top "← Back" button's `navigate({ to: "/" })` with `useSmartBack({ to: "/gallery" })`.
- **`src/routes/settings.tsx`** (line 117 area, "Back to profile") — use `useSmartBack({ to: "/me" })`.
- **`src/routes/workshops.$slug.archive.tsx`** ("Back to Workshop" arrow) — use `useSmartBack({ to: "/workshops/$slug", params: {...} })`.
- **`src/routes/works.$slug.edit.tsx`** ("Back to Gallery" arrow at line 194) — use `useSmartBack({ to: "/works/$slug", params: {...} })` so editors return to the work, not gallery.

### Out of scope (intentional)

- Named "Back to Gallery" / "Back to Collab Board" / "Back to Lounge" links stay as-is — those are labeled destinations, not generic back affordances, and users expect them to go where the label says.
- Error/notFound fallback buttons (also labeled) stay as-is.
- No changes to auth redirects (`login`, `onboarding`, `reset-password`) — those correctly land on `/` post-action.

## Verification

- From `/u/<me>` click a work → click "← Back" → land back on the profile with scroll preserved.
- Open a work via direct URL (new tab) → click "← Back" → land on `/gallery` (fallback).
- From `/me` → Settings → "Back to profile" → returns to `/me`.
