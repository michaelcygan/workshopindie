# Lounge refresh — next pass

The rebrand is in. This pass turns Lounge into a real surface attached to Groups and Collabs, replaces the old "promote room to persistent Workshop" flow with a simple in-Lounge collab pop-up, and prepares the `/workshops` scheduled surface for retirement (folded into Events).

## 1. Group Lounges (public, drop-in, auto-join group)

Goal: any Group page can open a live Lounge scoped to that Group. Anyone can join; joining auto-adds the user as a group member.

- `Open the Lounge` primary button in `group-hero.tsx` (next to Join/Share).
- New server fn `joinGroupLounge({ groupId })` in `src/lib/instant.functions.ts`:
  - Insert into `group_members` (ignore duplicate) so the joiner becomes a member.
  - Find an `instant_rooms` row where `group_id = $1, status = 'active'` and current presence count < cap; reuse it.
  - If none, create one with `kind='lounge'`, `group_id`, `title = "<Group name> Lounge"`.
  - Return `{ roomId }`.
- Group Lounge tab body (the existing "Workshops" tab): list live rooms for the group + a "Open a new room" CTA. Reuses `LiveWorkshopsRail` filtered by `group_id`.
- Logged-out click → existing `SignupGateModal` flow with a `pendingAction` that replays `joinGroupLounge` after signup. The auto-join still runs because the server fn does it server-side.
- RLS for `instant_rooms`: public SELECT when `group_id IS NOT NULL AND collab_id IS NULL` (already in place from prior migration — verify).

## 2. Collab Lounges (private, members-only)

Goal: a Collab's confirmed cast has a private room they can drop into anytime.

- `Open the Lounge` button on `collab.$slug.tsx`, visible only to owner + accepted applicants + accepted invitees (uses existing `can_access_collab_lounge` helper).
- New server fn `joinCollabLounge({ collabId })`:
  - Verify caller via `can_access_collab_lounge`; reject otherwise.
  - Reuse the row where `collab_id = $1, status='active'`, else create one with `kind='lounge'`, `collab_id`, title `"<Collab title> Lounge"`.
- `lounge.$id.tsx`: when a row has `collab_id`, render a `Private — Collab cast only` pill in the header and a friendly "Members only" empty state for non-members instead of a generic 404.
- Collab lounges never surface on `/lounge` discovery tabs.

## 3. "Create a Collab" from inside the Lounge (popup, no navigation)

Replaces the old "Fork this live Workshop into a persistent Workshop" flow.

- Delete the fork UI from `lounge.$id.tsx`: the `isPromoted` banner, `promoted_at`/`source_workshop_id` checks, the Sparkles "promoted" badge, and `promoteRoom` / `acceptWorkshopJoinInvite` / `declineWorkshopJoinInvite` imports.
- Delete `src/lib/collab-workshop.functions.ts` entirely (no other call sites after the route cleanup).
- Add a `<CreateCollabDialog />` opened by a `+ Collab` button in the Lounge tool bar. It mounts a thin wrapper around the existing `/collab/new` form (title, category, short pitch, optional cover) and submits via the existing server fn.
- Owner = the individual who opened the dialog. The room itself is NOT formalized — no `source_workshop_id`, no `promoted_at`.
- After create: toast "Collab posted — pin it to this Lounge?" with a one-tap action that writes to `instant_room_work_pins` (or a parallel `instant_room_collab_pins` if pinning collabs needs its own table — confirm before migration).
- The active Lounge session never unmounts; mic/cam stay live.

## 4. Retire the old `/workshops` scheduled surface (prep only)

Scheduled workshops fold into Events per the prior decision, but the data still exists. This pass does only the safe prep:

- Sweep nav, footers, Create menus, and landing rails for any remaining `/workshops*` links and remove them.
- Add `beforeLoad` redirects from `/workshops` → `/events`, and `/workshops/$slug` → `/events` (mapped event lookup comes in the migration pass).
- Leave the route files and DB tables intact this turn. Full deletion + data migration to `events` is the *following* pass.

## 5. Cleanup

- Delete `src/components/workshop-recorder.tsx`, `workshop-recording-link.tsx`, and `src/components/recorder/` — already pulled from the picker, no other call sites.
- Delete `src/lib/lobby.functions.ts` and lobby UI (lobbies are gone; Lounges are joined, not planned).
- Remove `recorder_personas` UI surfaces (tables stay; UI only).
- Sweep one last time for user-facing "Workshop" strings outside the brand wordmark.

## Technical notes

- `instant_rooms` already has `group_id`, `collab_id`, `kind`, `status`, `creator_id` from the prior migration. No new DB migration needed for steps 1–3.
- New server fns live in `src/lib/instant.functions.ts` next to `joinLounge` / `joinMediumLounge` and follow the same `requireSupabaseAuth` + Zod shape. `joinGroupLounge` does the `group_members` insert before the room lookup.
- `joinGroupLounge` ignores duplicate-key errors on `group_members` (same pattern as `joinGroup` in `src/lib/groups.functions.ts`).
- `CreateCollabDialog` reuses the existing `/collab/new` form — extract it into `src/components/collab/collab-composer.tsx` if it's still embedded in the route file.

## Out of scope this pass

- Migrating existing `workshops` rows into `events`.
- Deleting `workshops*` route files and tables.
- Group Lounge moderation tools (kick, lock) — already covered by existing room host controls.

## Build order

1. `joinGroupLounge` + `joinCollabLounge` server fns.
2. `Open the Lounge` buttons on `g.$slug.tsx` and `collab.$slug.tsx`; private-state UI on `lounge.$id.tsx`.
3. Delete fork-to-Workshop flow; add `CreateCollabDialog` + pin action.
4. `/workshops*` redirect shims + nav sweep.
5. Recorder / lobby / leftover-string cleanup.
6. Verify build.
