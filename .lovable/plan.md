# Collab lifecycle — what's left (Waves 5, 7 remnants, 8)

Waves 0–4 and 6 are done: derived lifecycle state, simplified creation, atomic Publish Work, the rebuilt Collab detail page, and the four-tab My Collabs screen. Three things remain.

## Wave 5 — Collaborators tab (the biggest remaining piece)

The applicants panel still speaks the old guest-only vocabulary ("Mark contacted", "Spam") and shows one flat list. The database already has the shared review vocabulary (`review_status` on both `collab_contact_events` and `collab_guest_applications`), so this is a UI + server-action pass:

- Owner subfilters: **Team**, **Applicants**, **Pitches**, **Declined**, with **Spam** as a secondary/hidden filter.
- Exact counts instead of vague language ("1 new application", "2 pitches", "You + 1 collaborator").
- Row actions: Accept, Message, Decline, Undo decline, Mark spam (guests only).
- Group repeat applicants by person so counts don't inflate.
- Unclaimed guests read as "Invited · awaiting account".
- Non-owner collaborators see the Team list only, with no contact details.

## Wave 7 remnants — three real gaps and some copy

Verified still outstanding:

1. **Free-tier quota counts the wrong thing.** The entitlement check counts Collabs with `status = 'open'` instead of Collabs effectively accepting submissions, so a paused or expired Collab either wrongly counts or wrongly frees a slot. The matching database trigger (`enforce_collabs_quota`) needs the same correction.
2. **Copy pockets** still saying the retired vocabulary: the Collab Board heading "Open Collabs" and its empty states ("Nothing open right now"), "Open Collab page" in the creation flow, and one home-feed line reading "Open Collab from …".
3. **"Post to Gallery"** is still the label on the standalone Work publishing screen. Wave 6 renamed it inside the Collab flow only; renaming it here makes the vocabulary consistent.

## Wave 8 — verification

- Extend the test suite to the scenarios not yet covered: pause semantics, server rejection while paused or expired, access retention after archive, double-publish idempotency, anon isolation, legacy row mapping, and quota counting.
- Widen the vocabulary lint to fail on "Post to Gallery" and "Open Collab" as well as the already-banned terms.
- Manual RLS matrix on a live Collab: owner, accepted collaborator, applicant, signed-in stranger, anonymous — checking in-progress, paused, published, archived, and legacy private rows.

## Technical notes

- No new schema is needed except the quota trigger correction; `lifecycle_state`, `applications_open`, and `archived_at` are already in place.
- Everything routes through `src/lib/collab/lifecycle.ts` and `src/lib/collab/query.ts` — no surface re-derives state from `status`.
- Suggested order: Wave 5 (user-visible), then the quota fix, then copy plus tests in one closing pass.
