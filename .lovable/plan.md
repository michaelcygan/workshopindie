
## Goal

One conceptual "Lounge" per group, but backed by the same matchmaker used for the public Lounge — so if the room is full, a second (then third) group-scoped room spawns automatically. No forking UI, no picker, no separate tab.

If Chicago vs. Chicago Writers needs to be a distinction, that's a separate `Chicago Writers` group (its own Lounge) — this plan is only removing the in-group forking surface.

---

## Changes

### 1. Group page — remove the "Lounge" tab

`src/components/group/group-tab-bar.tsx`
- Drop the `{ id: "workshops", ... }` tab entry, so the row becomes: Today · Collabs · Work · Events · (Groups if children) · Members · About.
- Keep the "Open the Lounge" item in the trailing "Create" dropdown.

`src/routes/g.$slug.tsx`
- Remove the `"workshops"` case from the tab renderer.
- Delete `GroupWorkshopTab` (dead once the tab is gone) and its supporting imports.
- Drop `workshops` from the `counts` prop and stop reading `workshop_count` / the `group_workshops` realtime subscription used only for that badge.
- If the URL still lands on `?t=workshops` (old link), fall back to `today`.

The "Open the Lounge" button already lives in `GroupHero` and calls `joinGroupLounge` — that stays as the single entry point.

### 2. Group Lounge matchmaker — spawn a sibling room when full

`src/lib/instant.functions.ts` → `joinGroupLounge`
- Replace the "find one active, else create one" logic with a matchmaker query modeled on `join_lounge`:
  - Consider all `instant_rooms` where `group_id = data.groupId`, `kind = 'lounge'`, `status = 'active'`, `visibility = 'open'`, not locked, live_count < cap (5), not blocked-pair, not in the caller's removal cooldown.
  - Order: prefer rooms hosted by someone the caller follows, then highest live count, then oldest.
  - If none qualifies, insert a new group-scoped room (same shape as today: `kind='lounge'`, `group_id`, `visibility='open'`, `participant_cap=5`).
- Keep the auto-join to `group_members` side-effect.

Implementation choice: do this in a new RPC `public.join_group_lounge(_user_id, _group_id, _exclude_room_ids)` mirroring `join_lounge`, and call it from `joinGroupLounge` via `supabaseAdmin.rpc(...)`. Keeps parity with the other matchmakers and reuses the same `is_blocked_pair` / `is_follow` helpers.

### 3. Surface group Lounges on /lounge and homepage (members only)

Currently `join_lounge`, `join_medium_lounge`, and `list_active_instant_rooms` all filter `group_id IS NULL`, so group rooms are invisible on public surfaces. Change surfacing (not matchmaking):

- `list_active_instant_rooms(_viewer uuid)` — include group-scoped rooms only when the viewer is a member of that room's group. Everything else unchanged. Public (null-group) rooms still surface to all.
- Public matchmakers `join_lounge` / `join_medium_lounge` are unchanged — they still skip group rooms so a random "drop me in" doesn't teleport a non-member into Chicago's Lounge. Group rooms are only entered via the group's "Open the Lounge" button (or by clicking a surfaced card, which routes through `joinSpecificInstantRoom` — that already enforces access via `getInstantRoom`'s member check for the room detail view).

Client rails (`LiveWorkshopsRail`, homepage tickers) already consume `listActiveInstantRooms`, so they'll pick up the new member-scoped rows automatically. Room cards for group Lounges will show the room title (e.g. "Chicago · Lounge").

### 4. Route fallback for old links

`src/routes/g.$slug.tsx`
- In the `?t=` parser, map legacy `workshops` → `today` so any external/shared link that pointed at the tab still loads a valid tab instead of a blank body.

### Out of scope

- No About-tab "related groups" linker in this change — that's a separate feature (would need a `related_groups` table + an editor). Call it out as a follow-up rather than bundling it here.
- No changes to `/lounge/$id` room UI, rename/end rules, Hop, or the 5-seat cap.
- No changes to `hostInstantWorkshop` (public Lounge hosting is unaffected).
- No data migration — existing group rooms keep working; new ones spawn as needed.

---

## Technical notes

- Migration file will define the new `join_group_lounge` RPC (SECURITY DEFINER, `GRANT EXECUTE ... TO authenticated`) and replace `list_active_instant_rooms(_viewer uuid)` to include `group_id IS NULL OR EXISTS (member row for _viewer)`.
- `joinGroupLounge` server fn keeps its `requireSupabaseAuth` middleware and its `group_members` upsert; only the room-selection block changes to call the new RPC.
- No changes to `src/integrations/supabase/types.ts` are needed by hand — regenerated after migration approval.
