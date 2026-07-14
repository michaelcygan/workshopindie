## What's wrong now

A Lounge is marked "empty" the moment the last user leaves (an `emptied_at` timestamp is stamped by a DB trigger). But then:

1. **Grace period is 30 minutes** before the sweeper archives it (`sweep_stale_lounges` uses `now() - 30 minutes`).
2. The matchmaker (`join_lounge`, `join_medium_lounge`) also uses a 30-minute stale window, and while a room is in that grace window it is still **preferred** by the matchmaker (sorted higher because it was recently emptied and has capacity).
3. Discovery (`list_active_instant_rooms`) shows these dying rooms as normal live rooms.

Net effect: someone leaves → the room hangs around for up to 30 minutes, still visibly enterable and still handed out first by matchmaking.

## Change (backend-only, one migration)

**1. Short end-timer, 45 seconds.**
- `sweep_stale_lounges`: change grace from `interval '30 minutes'` → `interval '45 seconds'`.
- Keep the 1-minute pg_cron cadence (worst case: room archives ~1:45 after last leave, well within the 25–60s intent given cron granularity).
- Keep the `_live_cutoff` at 5 minutes so a brief network blip doesn't kill an active room — the trigger only stamps `emptied_at` when the presence row is actually deleted (on unmount / Hop / tab close via cleanup), so real "user left" events fire immediately.

**2. Matchmaker ignores dying rooms.**
- In `join_lounge` and `join_medium_lounge`:
  - Shrink `_stale_cutoff` to 45 seconds so the pre-archive step matches the sweeper.
  - Add `AND r.emptied_at IS NULL` to the candidate SELECT so rooms in the grace window are never picked, regardless of live-count sort.
  - Remove the `(live_count > 0) DESC` first sort key — with dying rooms excluded, prefer follows, then live-count, then age (this stops matchmaking from stacking users into a room that's already ticking down).

**3. Discovery hides dying rooms.**
- In `list_active_instant_rooms`, add `AND r.emptied_at IS NULL` so the "Live now" list drops a room the instant its last occupant leaves. The 45s window then ends in archive without the room ever reappearing as joinable.

**4. No client changes.** `channel-view.tsx` already deletes the presence row on unmount, which fires the existing trigger that sets `emptied_at`. `HopButton` already deletes presence before navigating. That path is correct; only the DB timings and filters are wrong.

## Files touched

- New migration under `supabase/migrations/` replacing `sweep_stale_lounges`, `join_lounge`, `join_medium_lounge`, `list_active_instant_rooms` with the changes above. No table changes, no new grants beyond re-issuing the existing ones for the replaced functions.

## Out of scope

- Group-scoped lounges (`join_group_lounge`) — same treatment can follow if you want, say the word and I'll include it.
- Workshop-paired rooms (`kind='workshop'`) are unaffected; this is lounge-only.
