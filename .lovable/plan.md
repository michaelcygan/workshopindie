## Goal

Turn the "Pinned" area on the profile (currently works-only) into a unified **Pin Bar** — a compact, horizontally-scrollable "featured / quick-select" row that mixes pinned Works and pinned Collabs. Works on mobile and desktop. Pinning uses the same flow already established on the Work detail page (a Pin button on the item itself), extended to Collabs.

## Scope

- Add collab pinning that mirrors work pinning.
- Replace the current "Pinned" section on `u.$username` with a single Pin Bar.
- Keep the existing empty-state copy intent, updated to mention both.

Out of scope: reordering (pins stay sorted by `pinned_at desc`), groups/events, changing the mediums chip row below.

## Data

Mirror the existing `work_credits.pinned_at` pattern.

- `collab_posts.pinned_at timestamptz null` — nullable, indexed. Pinnable only by the post owner (`user_id = auth.uid()`), enforced in the server fn (RLS already restricts updates to owner).
- No schema change for works — keep `work_credits.pinned_at` as-is.
- Combined cap of **6 pins total** across works + collabs (matches the current `MAX_PINS = 6`). Enforced server-side.

## Server functions (`src/lib/`)

- `togglePinCollab({ collabId })` — mirrors `togglePinCredit`; sets/clears `collab_posts.pinned_at`; enforces owner + combined 6-pin cap (counts work_credits pins + collab pins for this user).
- `getMyPinForCollab({ collabId })` — mirrors `getMyPinForWork`; returns `{ pinned, totalPinned, maxPins }`.
- Update `togglePinCredit` cap check to also count collab pins so the ceiling is shared.

## UI

**Collab detail page (`src/routes/collab.$slug.tsx`)** — add the same Pin/Unpin button used on the Work page (visible only to the owner), reusing the styling from the `PinButton` in `works.$slug.tsx`.

**Profile Pin Bar (`src/routes/u.$username.tsx`)**
- New `fetchPinnedCollabs(userId)` alongside `fetchPinnedWorks`; merge into a single `pins: PinItem[]` sorted by `pinned_at desc` (max 6).
- Replace the existing "Pinned" `<section>` (and the mobile-hidden branch) with a `PinBar` component:
  - Horizontal `overflow-x-auto snap-x` row of compact cards (~140px wide on mobile, ~180px on desktop): cover thumbnail, title, small type badge ("Work" / "Collab"), tap → item route.
  - Shown whenever `pins.length > 0`, on both mobile and desktop, above the medium chip row.
  - Empty state (own profile only, when there are items to pin): "No pins yet. Open a Work or Collab you're on and tap **Pin** to feature it here."

## Edit-profile flow

The `Pinned pieces` section in `src/routes/me.edit.tsx` already syncs `pinned_work_ids` on save; leave the current works picker in place but relabel the section "Pinned works" and add a short caption noting collabs are pinned from the collab page (matches the works flow — no new picker needed, keeping "same established flow").

## Technical notes

- One migration: add `pinned_at` column + index on `collab_posts`; no new grants (table already has them).
- Type regen for `collab_posts` picks up the new column automatically.
- Query keys: `["profile-pinned-collabs", profile.id]`; invalidate alongside existing `profile-pinned` on toggle.
- Verification: Playwright at 375×812 and 1280×900 — pin a work, pin a collab, confirm both appear in the bar in most-recent-first order, unpin removes them, 7th pin shows the cap toast.

## Files

- new migration adding `collab_posts.pinned_at`
- `src/lib/works.functions.ts` — extend cap check
- `src/lib/collabs.functions.ts` (or nearest existing collab functions file) — add `togglePinCollab`, `getMyPinForCollab`
- `src/routes/collab.$slug.tsx` — Pin button
- `src/routes/u.$username.tsx` — new `PinBar`, replace old Pinned section, merged fetch
- `src/routes/me.edit.tsx` — label/caption tweak only
