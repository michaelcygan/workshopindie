## Workshop flow audit — v1 polish pass

Goal: tighten what's already shipped. No new primitives, no schema sprawl. Mostly wiring, presentation, and two small unlocks that drive stickiness (hop-to-next, edit title mid-room).

---

### A. Wiring + correctness fixes (no UI noise)

1. **`liveCount` in `/workshop` is never set.** `LiveTopicsList` calls `onLiveCountChange`, but the subtitle, the rejoin pill placement, and the "first visit / spark" line all depend on it. Verify it actually fires; today the header sometimes shows "No one's in yet" while the rail below has live rooms. Fix the prop wiring + add a fallback derived from `liveByMedium` sum.
2. **`getInstantRoom` server fn is out of date** — selects `…, status` but not the new `focus_message, locked, ended_by_user_id`. Anywhere that reads through this fn is silently missing host state. Update the select.
3. **`endRoom` sets `status = 'archived'` but the route's `useQuery` polls every 5s and never reacts to ended state.** Today guests rely solely on the `ended` broadcast; anyone who joins after the broadcast lands in a zombie room. Add: when `room.status !== 'active'` and not host, route to `/workshop` with a toast ("This Workshop ended").
4. **Host `useEffect` leave-stash runs for ended rooms too**, so guests who get kicked or whose host ended the room get a "Rejoin" pill back on `/workshop` that 404s into a locked/archived room. Skip the stash when `room.status !== 'active'` or `locked`.
5. **`HostRoomEvents` `mute_all` toast** uses `document.querySelector('[data-mic-toggle]')` — confirm `ChannelView` actually emits that attribute on the mic button. If not, drop the auto-action and keep the toast advisory ("Tap your mic to mute"). One quick edit either way.
6. **`broadcast()` in `HostMenu` creates a fresh channel per call and never `subscribe()`s.** Supabase requires `subscribe()` before `send()` works reliably. Reuse the same channel as `HostRoomEvents` via a small `useHostBroadcast(roomId)` hook (one channel per room).

### B. Host quality-of-life (the asks)

7. **Edit title mid-Workshop.** Add to `HostMenu`: "Rename Workshop" → dialog with the current title, 120-char cap, host-only RLS already covered by `assertHost`. New tiny server fn `setRoomTitle` next to `setRoomFocusMessage`. Title in the header updates via the existing 5s refetch + an optimistic invalidate. No schema change.
8. **Hand off host.** New menu item "Transfer host…" → picks from the same `participants` list as Remove. Server fn `transferHost` updates `instant_rooms.host_user_id`. Useful when the host has to drop. No schema change.
9. **Copy share link from the menu** (one-tap, also available outside the "waiting" card). Today the only path to the link is the waiting-card before others arrive.

### C. Matching + join/exit upgrades

10. **"Hop to next Workshop" — the speed/persistence unlock you asked for.** Add a `<HopButton />` in the room header (next to Leave) and a keyboard shortcut `N`:
    - Calls `joinLounge` (or `joinMediumLounge` if the current room has a medium) **excluding** the current `roomId`. Add a `_exclude_room_id` arg to both RPCs via migration (one-line `AND r.id <> _exclude` filter).
    - On success: drop presence row for current room → `router.navigate` to the new room id with the same `mode` search param. ChannelView already keys off `roomId` so it remounts cleanly.
    - If matchmaker returns the same room (only one live), the server returns `null` → button toasts "No other rooms right now. Open a new one?" with a one-tap host shortcut.
    - This is the persistence loop: scroll-style room hopping, low complexity, big behavior change.
11. **Auto-spawn after end.** When the host ends or you get kicked, show one-tap "Find another" in the toast that calls the same hop logic. Removes the dead end.
12. **Block re-match into rooms you recently left** (last 5 min). Reuse `instant_room_removals` semantics with a new `instant_recent_exits` lightweight table OR just a `last_exited_at` column on the existing presence row's last value — simplest: keep a client `sessionStorage` skip-list and pass it as `_exclude_room_ids` to matchmaker. Avoids "ping-ponging back into a room you just left."

### D. UI polish (low code, high impact)

13. **Room header is information-dense.** Reflow on mobile: title row → host meta row (Hosted by + Locked + Hop/Host menu/Create Collab) → focus strip. Today everything fights for the first row.
14. **Focus strip** — promote visually when present (subtle gradient border, slightly larger, sticky under header on scroll). It's currently a hairline that disappears once you scroll.
15. **HostedByLine** — when the host is `auth.uid()`, render as "Hosting" pill instead of "Hosted by You" to avoid redundancy with the Crown badge.
16. **"Spin up" button on `/workshop`** — when `hostMedium` is preselected from a prompt, show the inspired-by chip beside the CTA instead of inside the dialog only. Better continuity.
17. **Rejoin pill** — show countdown ring (60s) so the affordance feels alive, and add `Dismiss` X to clear early.
18. **Waiting-for-others card** — once `liveCount > 1`, animate it out (fade + height collapse) instead of unmount-snap.

### E. Stickiness unlocks (no new builds)

19. **First-room receipt.** After a user's first room (track via `localStorage`), surface a one-time card on `/workshop`: "You hosted/joined your first Workshop. See who else is live →" — drives second session within minutes.
20. **Auto-prompt nudge for empty mediums.** When a category has 0 live rooms and the user has been on `/workshop` for >20s, the prompt marquee picks a category-relevant prompt and surfaces it as a soft CTA ("Be the first in Music tonight"). Pure presentational reuse of existing `RoomPromptMarquee`.
21. **"Last 24h" recap chip** under the header: "12 Workshops happened today" — pulls from `instant_activity`. Social proof without a leaderboard.

---

### Technical map

- **Server fns (new, all under existing `host-room.functions.ts`):** `setRoomTitle`, `transferHost`. Both `requireSupabaseAuth` + `assertHost`.
- **Server fn changes:** `joinLounge`, `joinMediumLounge` accept optional `excludeRoomIds: string[]`; `getInstantRoom` selects the host columns.
- **Migration (one):** add `_exclude_room_ids uuid[] DEFAULT '{}'` arg to both `join_lounge*` RPCs with `AND r.id <> ALL(_exclude_room_ids)` filter. No table changes.
- **New component:** `HopButton` (header) + tiny `useHostBroadcast(roomId)` hook (replaces `HostMenu`'s ad-hoc channel).
- **Edits:** `workshop.$id.tsx` (status guard, header reflow, HopButton, sticky focus strip), `workshop.index.tsx` (liveCount wiring, recap chip), `HostMenu` (Rename, Transfer, Copy link), `HostedByLine` (self case), `WaitingForOthersCard` (exit animation), `host-room.functions.ts` (+2 fns), `instant.functions.ts` (exclude args).

### Out of scope for this pass
- Raise hand / spotlight / per-guest perms (v2 host).
- Persistent bans, recording, force-mute via SFU.
- Any redesign of `ChannelView` internals.

Want me to ship all of A–E, or trim to a tier (A+B+C only is the lean version; D+E are pure polish/growth)?
