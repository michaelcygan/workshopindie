# Lounge refresh — what's left

Step 1 is partway done: `joinGroupLounge` + `joinCollabLounge` server fns exist, and the Group hero has an **Open the Lounge** button that auto-joins the group. Everything below is still outstanding.

## A. Collab side (private Lounge wiring)

- Add an **Open the Lounge** button on the Collab page (`collab.$slug.tsx`), visible only to the owner + accepted invitees + accepted guest applicants. Calls `joinCollabLounge` and navigates to `/lounge/$id`. Non-members see a quiet "Members only" hint instead of the button.
- In `lounge.$id.tsx`, when the room has a `collab_id`:
  - Show a `Private · Collab cast only` pill in the header.
  - If a non-member somehow lands on the URL, render a friendly "Members only" empty state instead of the generic 404.
  - Hide the matchmaker's "Skip" button (private rooms shouldn't shuffle into open lounges).
- Confirm Collab lounges never appear in `/lounge` discovery (filter `collab_id IS NULL` in the active-rooms RPC; add if missing).

## B. "Create a Collab" from inside the Lounge (popup, no nav)

Replaces the old fork-to-persistent-Workshop flow.

- Delete the fork UI from `lounge.$id.tsx`: the `isPromoted` banner, the violet "this Lounge became a Collab" card, the `Sparkles` promoted badge, the `acceptWorkshopJoinInvite` / `declineWorkshopJoinInvite` invite block, and the existing `CreateCollabSheet` that calls `createCollabFromRoom`.
- Replace with a new `<CreateCollabDialog />` opened by the existing **Create a Collab** button in the room header. It mounts a thin wrapper around the `/collab/new` composer (title, category, short pitch, optional cover) and submits via the existing Collab create server fn. The active Lounge session never unmounts — mic/cam/screenshare stay live.
- Ownership: the dialog's submitter is the Collab owner. The room itself stays informal — no `source_workshop_id`, no `promoted_at`, no auto-invites to other room participants.
- After create: toast "Collab posted — pin it to this Lounge?" with a one-tap pin action (writes to `instant_room_collab_pins`; add the table only if it doesn't already exist — verify first).
- Delete `src/lib/collab-workshop.functions.ts` and `src/components/start-workshop-from-collab-button.tsx` once no call sites remain.

## C. Group Lounge tab body

The Group page's "Lounge" tab currently points at the old workshops list. Replace with:

- A live-rooms strip filtered to `instant_rooms.group_id = <this group>` and `status = 'active'`, reusing the existing live-rooms card component.
- A primary "Open a new room" CTA that also calls `joinGroupLounge`.
- Empty state: "No one's in the Lounge right now — be the first."

## D. Retire `/workshops` (safe prep only)

- Add `beforeLoad` redirects: `/workshops` → `/events`, `/workshops/$slug` → `/events`. Mapped-slug lookup is the *following* pass.
- Sweep remaining `/workshops*` links from top nav, mobile nav, footer, Create menu, landing rails, profile tabs, DMs, work pages, home rails, and the groups-join feed cards.
- Leave route files + DB tables intact. Full deletion + `workshops → events` data migration is a later pass.

## E. Cleanup sweep

- Delete `src/components/recorder/`, `workshop-recorder.tsx`, `workshop-recording-link.tsx` (recorder is already off the picker; no other call sites).
- Delete `src/lib/lobby.functions.ts`, `src/routes/workshops.lobby.new.tsx`, and any lobby UI. Lounges are joined, not planned.
- Remove the "Become host" / "Claim Host" affordance in private Collab Lounges (the owner is implicit host).
- One final string sweep for user-facing "Workshop" outside the brand wordmark — top-nav, toasts, empty states, notifications (`workshop_live` kind label, etc.). The DB enum value can stay; only the label changes.

## Out of scope this pass

- Migrating `workshops` rows into `events`.
- Deleting `workshops*` route files and tables.
- New Group Lounge moderation tools (existing host controls cover it).

## Build order

1. Collab page button + private-state UI on `lounge.$id.tsx` (Section A).
2. In-Lounge `CreateCollabDialog` + delete fork code (Section B).
3. Group Lounge tab body (Section C).
4. `/workshops` redirects + link sweep (Section D).
5. Recorder / lobby / string cleanup (Section E).
6. Verify build.
