# "Here now" presence cluster in the NOW board header

Fill the empty space in the NOW board header (left of the pause/arrow controls) with a live avatar cluster of people who are online right now — hover shows their name, click opens their profile. Invisible when nobody qualifies, so the header looks exactly as it does today in the empty state.

## What exists today (verified)

- `public.user_presence` is the ephemeral online tier: one row per person with `last_seen_at` and their own `show_online` flag. `src/lib/presence/policy.ts` defines the online window (2 minutes) and `isOnline()`.
- `getFriends` in `src/lib/friends.functions.ts` already computes mutual follows from `follows` (both directions), filters out `user_blocks` in both directions, joins `user_presence`, and honors `show_online`. That is the exact shape this feature needs.
- Groups already have a "Here now" cluster: `src/components/group/today-presence-bubbles.tsx` (avatars + tooltips, `+N` overflow) fed by ephemeral Realtime presence in `src/hooks/use-group-presence.ts`. That one is per-group Realtime and hides itself when empty.
- The NOW header lives in `src/components/home/now-board-desktop.tsx`; the mobile variant is `now-board-mobile.tsx`.

## The change

1. **New server function** `getHereNow({ scope })` in a new `src/lib/here-now.functions.ts`, auth-required, returning at most ~12 people: `{ user_id, display_name, username, avatar_url }`. Scopes:
   - `mutuals` (default) — mutual follows, reusing the same logic as `getFriends`.
   - `city` — members of the viewer's default city group.
   - `groups` — members of any group the viewer belongs to.
   - `everyone` — anyone on Workshop.
   Every scope filters to `isOnline(last_seen_at)`, drops anyone with `show_online = false`, drops blocked-in-either-direction users, and drops the viewer themself. Sorted most-recently-seen first.
2. **New component** `src/components/here-now-cluster.tsx` — visually the same language as the Groups cluster: `HERE NOW` label in the existing muted uppercase micro type, overlapping 24px avatars, `+N` overflow chip. Each avatar is a link to `/$username` with a tooltip showing display name and `@handle`. Polls on the presence heartbeat cadence (60s) via React Query; renders `null` when the list is empty or the viewer is logged out.
3. **Scope switcher.** A small control on the cluster (the `HERE NOW` label acts as the trigger) opens a popover with Mutuals / My city / My groups / Everyone. The choice persists per browser in `localStorage`; no schema change. Default is Mutuals.
4. **Placement.** Render the cluster in the NOW board header in `now-board-desktop.tsx`, between the `NOW · CITY · UPDATED …` line and the playback controls. Also render it in `now-board-mobile.tsx` header where space allows (avatars only, label hidden below `sm`, capped at 3 + overflow).

## Notes

- No new tables, no new writes: this reads the presence tier the heartbeat already maintains.
- Privacy: a person who turned off "show online" never appears in any scope, including `everyone`.
- Blocks are respected in both directions for every scope.
- Verification: typecheck plus a homepage pass at desktop and 390px confirming the header does not wrap and the cluster is absent when empty.
