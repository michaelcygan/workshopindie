# Remove the legacy collaborative Work flow

One canonical model for finished work: Post to Gallery + credits. The standalone Collab listing feature and Work credits stay untouched.

## What gets removed

- `src/routes/works.collab.new.tsx` — the "Start a collaborative piece" page (visibility modes, rights/license selection, ownership splits, collaborator rows). Replaced by a route that immediately redirects to `/works/new` using history replacement.
- `src/routes/works.invite.$token.tsx` — the invite-link acceptance page (the only consumer of the invite-token + agreement-signing mechanics). Also redirects to `/works/new` rather than 404ing shared links.
- In `src/lib/works.functions.ts`: the `createCollaborativeWork` and `redeemWorkInviteToken` server functions plus their Zod schemas (`SplitSchema`, `CreateSchema`, `RedeemSchema`) and the now-unused `crypto` import. The portfolio pinning functions in that file (`togglePinCredit`, `getMyPinForWork`) stay.
- In `src/routes/works.new.tsx`: the secondary CTA link "Or start a collaborative Work — invite people to publish it with you →" and its spacing. Nothing else on that page changes.

## What stays

- `/works/new` layout, fields, media handling, taxonomy, rights-reassurance copy, responsive behavior.
- Work credits everywhere (`work_credits` reads/writes on the Work page, profile, gallery, home, collab publish).
- All Collab surfaces: `/collab`, individual Collab pages, creating/applying, discovery/filters, `/start-a-collab`, Collab→Work publishing via `publish_work_from_collab`.
- The read-only `work_collaborators` count on a published Collab's page — it reads a table the RPC still populates, so it is left as is.

## Database

No migration. `work_agreements`, `work_agreement_signatures`, `work_collaborators`, `work_invite_tokens`, and `works.is_collaborative` keep existing rows and policies. `work_collaborators` is still written by the Collab publish RPC; the other three become dormant after this change and will be reported as such.

## Verification

Typecheck, lint, tests, production build; then load `/works/new` at desktop and mobile widths and confirm `/works/collab/new` lands on `/works/new`.
