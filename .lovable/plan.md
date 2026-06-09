## Goal

Close the loop on the host-from-empty-state flow so a new room (1) shows up in **Live now** immediately, (2) tells the host who can see it, (3) reminds the host of their utilities, and (4) pings mutuals so something actually happens after the click.

## 1. Make brand-new rooms appear in "Live now"

**Problem:** `list_active_instant_rooms` filters `live_count > 0`. A room created from the empty state has no presence row yet, so the rail keeps saying "No one's live right now" until the host's `instant_presence` heartbeat lands a few seconds later. From the empty state, that's the exact moment the user wants the signal.

**Fix (SQL migration):** include rooms that are either currently live OR were created within the last 90 seconds by a host who is presumed present (`host_user_id IS NOT NULL`). Belt-and-suspenders on the client by also invalidating the `instant-active-rooms` query right after `hostInstantWorkshop` resolves on the workshop preflight page.

## 2. Privacy popup on every Workshop create (user picked "every time")

**New column** on `instant_rooms`: `visibility text NOT NULL DEFAULT 'open'` constrained to `'open' | 'mutuals' | 'invite'`.

**New component** `src/components/host-privacy-dialog.tsx`:
- Opens from both Host card on `/workshop` and the "+ Create → Start a Draft Workshop" path
- Three options with one-line explanations: Open (anyone can drop in), Mutuals only (people you mutually follow can see + join), Invite link only (hidden from Live now; share link to fill seats)
- Also shows the medium chip and a single editable title field so the user confirms what's about to spin up
- Confirms by calling `hostInstantWorkshop({ medium, title, visibility })`

**Server changes** (`src/lib/instant.functions.ts`):
- `hostInstantWorkshop` accepts `visibility`, writes to the new column.
- `listActiveInstantRooms` (and the `list_active_instant_rooms` SQL function) filter out `visibility = 'invite'` and, for `visibility = 'mutuals'`, only return rooms where the viewer is mutual-followed with the host. Switch the SQL fn to take the caller `_viewer uuid` and pass `auth.uid()` from the server fn.

`workshop.index.tsx` and `live-workshops-rail.tsx` already pass medium; only the dialog flow needs wiring.

## 3. First-time host quick tour inside the room

**New component** `src/components/host-first-run-tour.tsx`:
- Renders only on `/workshop/$id` when `isHost === true` AND `localStorage` key `wf:host-tour-v1` is not set
- Lightweight 3-step inline coach (popovers anchored to the tools panel, "Create", and the share link), not a modal — dismiss + "Don't show again"
- Steps: (a) "These are your host utilities — docs, drive, polls" (b) "Tap Create → Collab once there's something worth shipping" (c) "Share this link to fill the remaining seats" with a one-tap copy button
- After dismiss/finish, sets the localStorage key and emits a tiny toast: "You're hosting. Have fun."

Wire into `src/routes/workshop.$id.tsx` next to `<WorkshopToolsPanel />`.

## 4. Notify mutual follows when someone goes live (user picked: notify)

**New server fn** `notifyMutualsOnHost({ roomId })` in `src/lib/instant.functions.ts`, called from `hostInstantWorkshop` after insert:
- Pull mutual followers via existing `is_mutual_follow` pattern (single SQL: intersect `follows` both directions).
- Insert into `notifications` (kind `workshop_live`, entity_type `instant_room`, entity_id = roomId, payload `{ actor_name, room_title, medium }`). Respect `notification_preferences` (gate by a new prefs flag `workshop_live_from_mutuals`, default ON).
- Cap volume: skip if the host already opened a room in the last 30 minutes (rate-limit via `check_and_bump` action `workshop_live_notify:<userId>`).
- Hidden when `visibility = 'invite'` (no notification at all); for `mutuals` and `open` it fires.

Notification renderer in `src/components/notifications-bell.tsx`: add a new case linking to `/workshop/$roomId` with copy "X just opened a live Workshop — drop in".

## 5. Audit fixes found along the way

- `hostInstantWorkshop` returns `{ roomId }` but the preflight page never invalidates the rail query → add `qc.invalidateQueries(["instant-active-rooms"])` right before `router.navigate`.
- `workshop.$id.tsx` reads `room.category ?? room.medium` but `hostInstantWorkshop` only sets `medium` — confirm the tools panel scope falls back correctly (it does today; no change needed, just noting).
- `list_active_instant_rooms` deletes from `instant_activity` inside the function — leave as-is, but switch to `SECURITY DEFINER` parameter signature `(_viewer uuid)` and update callers.

## Technical details

**SQL migration:**
```sql
ALTER TABLE public.instant_rooms
  ADD COLUMN visibility text NOT NULL DEFAULT 'open'
    CHECK (visibility IN ('open','mutuals','invite'));

CREATE OR REPLACE FUNCTION public.list_active_instant_rooms(_viewer uuid)
RETURNS TABLE (...) ...
-- include rooms with live_count > 0 OR (created_at > now()-interval '90 seconds' AND host_user_id IS NOT NULL)
-- filter visibility = 'invite'
-- for visibility = 'mutuals', require is_mutual_follow(_viewer, host_user_id)
```

**Files touched:**
- `supabase/migrations/<ts>_workshop_visibility_and_freshness.sql` (new)
- `src/lib/instant.functions.ts` (visibility param, `notifyMutualsOnHost`, pass viewer to RPC)
- `src/components/host-privacy-dialog.tsx` (new)
- `src/components/host-first-run-tour.tsx` (new)
- `src/routes/workshop.index.tsx` (open dialog instead of direct host call; invalidate rail)
- `src/routes/workshop.$id.tsx` (mount tour for host)
- `src/components/notifications-bell.tsx` (render new notification kind)

## Out of scope

- Changing the matchmaker behavior for "Drop in" — already audited last turn.
- Privacy enforcement on `/workshop/$id` itself (anyone with the link can still join; this only affects discovery). Happy to add a follow-up plan for hard gating if you want it.
