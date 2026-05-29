## Goal

Finish `/u/$username` so it always renders the full profile structure — even on a brand-new account — with clear owner CTAs that push the user toward the two core flows: **Publish a Work** and **Post a Collab**.

## Scope

Single file: `src/routes/u.$username.tsx`. No backend, schema, or other route changes.

## Changes

### 1. Cover photo: owner empty state

Currently when `!profile.cover_url` we render a warm gradient with no affordance. Add an owner-only overlay:

- Keep the gradient as the empty background.
- When `isOwn && !profile.cover_url`, overlay a centered ghost button **"Add cover photo"** (with `ImagePlus` icon) that navigates to `/me/edit` (the edit form already has the cover uploader at line 310).
- When `isOwn && profile.cover_url`, show a small "Change cover" pill in the top-right corner on hover (subtle, doesn't break the cover image).

### 2. Always show all tabs for the profile owner

Today `visibleTabs` hides Credits / Workshops / Groups when empty. On a fresh account this collapses the profile to just **Works / Collabs / About**, hiding the structure the user is meant to grow into.

- When `isOwn`: show all 6 tabs unconditionally so the owner sees the full skeleton.
- When viewing someone else: keep current behavior (hide empty tabs to avoid dead ends for visitors).

### 3. Owner-facing empty states with dual CTAs

The point: every empty tab on an owner's profile should nudge toward Publish a Work **or** Post a Collab.

- **Works tab** (currently has only "Publish a Work"): add a secondary "Post a Collab" outline button alongside, so a new user sees both core actions at once.
- **Credits tab** (owner empty): change copy to "Get credited by collaborating. Post a Collab to start." + "Post a Collab" button.
- **Workshops tab** (owner empty): currently flat text — add CTAs "Drop into a Workshop" (primary → `/instant`) and "Schedule a Workshop" (outline → `/workshops/new`).
- **Collabs tab** (owner empty): already has "Post a Collab" ✓ — no change.
- **Groups tab** (owner empty): already has "Add your city in Edit profile" ✓ — no change.

### 4. Minor polish

- The stats strip already renders zeros gracefully — leave it. Confirms the skeleton reads as "ready to fill" rather than broken.
- Header action row: no change. "Edit profile / Drop a link / Publish a Work" already covers the top-of-page CTAs for owners.

## Out of scope

- Editing the `/me/edit` form, the cover uploader, or DB columns.
- Changing the `/me` dashboard (the screenshot is from `/me`, but the request is about the public profile).
- New tabs or new data sources.
