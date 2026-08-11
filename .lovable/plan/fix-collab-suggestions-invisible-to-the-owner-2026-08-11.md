# Fix: collab suggestions invisible to the owner

## What's happening

The Collab "1,000 producers on a track" has one real suggestion: a guest application with no role, status `new`, submitted Aug 11. The owner-facing Collaborators panel shows Team 0 / Applicants 0 / Pitches 0 / Declined 0.

Cause, confirmed against the database: the `authenticated` role has column-level SELECT on `collab_guest_applications` for every column except `claim_token`, `claim_token_expires_at`, and `review_status`. The owner panel's query asks for `review_status`, so the whole request is rejected for permissions. The code treats a failed fetch as "no rows" (`?? []`), so the panel renders four empty tabs with no error. The owner-only activity counter uses the admin client, which is why "1 open suggestion" still appears under Roles.

## Plan

1. Restore the missing read privilege: grant `SELECT (review_status)` on `collab_guest_applications` to `authenticated`. `claim_token` and `claim_token_expires_at` stay revoked — those must remain guest-only. Row-level policies already limit reads to the post owner and admins, so this does not widen who can see applications.
2. Stop swallowing failures in the applicants fetch: if either query errors, throw so the panel shows its "Couldn't load collaborators" state instead of a false empty.
3. Make suggestions findable in the UI:
   - Rename the "Pitches" tab to "Suggestions" (that is the word used everywhere else in the flow) and keep the count badge.
   - Make the "1 open suggestion" line under Roles a button that scrolls to the Collaborators panel and opens the Suggestions tab.
   - On load, default the panel to the first tab that actually has items waiting (suggestions or applicants) instead of always "Applicants".

## Technical notes

- Migration: single `GRANT SELECT (review_status) ON public.collab_guest_applications TO authenticated;`
- `src/lib/collab.functions.ts` — `listApplicants`: throw on `eventsRes.error` / `guestsRes.error`.
- `src/components/applicants-panel.tsx` — tab label, initial tab selection, and a small exported way to set the active tab (URL hash `#applicants` + a `defaultTab` prop or a custom event).
- `src/routes/collab.$slug.tsx` — turn the open-suggestion line into the jump control.
