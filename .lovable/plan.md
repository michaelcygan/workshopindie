# Lounge chat continuity + auto-close/delete lifecycle

Two related changes, one SQL migration + one small policy fix. No new UI.

## Problem today

- `instant_messages.expires_at` defaults to `now() + 24h` and a cron already
  deletes any row past that expiry. So chat vanishes 24h after posting even if
  the Lounge is still active — breaks continuity for newcomers.
- The `SELECT` policy on `instant_messages` requires an **active
  `instant_presence` row** for the reader. A user who leaves loses read access
  immediately; when they rejoin they see everything again (fine), but this
  same rule means a fresh joiner sees the full log as long as messages
  haven't expired — good, so no policy change needed for the reader side.
- Rooms today go `active → archived` only when `join_medium_lounge` sweeps
  stale rooms on the next join attempt (5-min presence gap). There's no
  scheduled sweep, no explicit "grace / rejoin window", and no auto-delete
  of archived rooms — old rooms and their messages linger indefinitely (or
  disappear early, per the 24h TTL above).

## Answers locked in

- **Rejoin grace window** after the room hits zero live presence: **15 min**.
  Empty past that → mark `status='archived'` (Lounge is closed).
- **Delete window** after close: **24 h**. Then hard-delete the room, which
  cascades and removes chat, presence, pins, etc.

## Migration (single change set)

1. **Stop the TTL from eating live-room chat.** Drop the 24h default on
   `instant_messages.expires_at` and set existing rows to `NULL`. Keep the
   column (cheap, and useful if we want short-lived rooms later). The
   existing cron `DELETE FROM instant_messages WHERE expires_at < now()`
   becomes a no-op for live chat — messages now live as long as the room.
   Chat still gets deleted with the room via the existing `ON DELETE
   CASCADE` on `instant_messages.room_id`.

2. **Add lifecycle timestamps to `instant_rooms`:**
   - `emptied_at timestamptz` — set when a sweep sees zero live presence,
     cleared when someone rejoins.
   - `closed_at timestamptz` — set when the room transitions to
     `status='archived'` by the sweep (or by an explicit end action).

3. **Add a `sweep_stale_lounges()` SECURITY DEFINER function** run by
   `pg_cron` every minute. It handles the whole lifecycle in one pass and
   is scoped to `kind IN ('lounge','workshop')` matched to the Lounge UX
   (skip `group`/`collab`-owned rooms if we don't want to auto-kill those —
   see Open question below):

   ```text
   -- 1. Stamp emptied_at on active rooms with no live presence (60s cutoff),
   --    clear it on any room that has live presence again.
   -- 2. Archive rooms whose emptied_at is older than 15 min:
   --      status='archived', closed_at=now(), ended_by_user_id=NULL.
   -- 3. Hard-delete archived rooms whose closed_at is older than 24 h.
   --    ON DELETE CASCADE handles instant_messages, instant_presence,
   --    instant_message_reactions, room pins, etc.
   ```

4. **Schedule with `pg_cron`:** `SELECT cron.schedule('sweep-stale-lounges',
   '* * * * *', $$ SELECT public.sweep_stale_lounges(); $$);` This is a
   pure-SQL scheduled task — no HTTP hook needed.

5. **Keep the existing `join_medium_lounge` 5-min sweep** as-is — it's a
   cheap on-demand cleanup that keeps matchmaking fresh. The new sweep is
   what governs the actual close/delete lifecycle.

## Client changes

None required for the core behavior. Optional small niceties (skip if we
want to keep this migration-only):

- On the Lounge route, if the loader/query resolves a room with
  `status='archived'`, render a "This Lounge closed — the chat log will be
  cleared in ~24h" read-only state instead of the live chat composer. This
  is nice but not needed for launch; the sweep will delete the room on
  schedule regardless.

## Open question I'll flag but not block on

`sweep_stale_lounges()` targets `kind='lounge'` only by default. Workshop-,
group-, and collab-attached rooms have their own lifecycles (a Workshop
persists across sessions; a Collab Lounge lives with the Collab). Scoping
to `lounge` avoids nuking those. If you want the same auto-close on any of
those, say the word and I'll widen the sweep's `WHERE kind IN (...)`.

## Files touched

- One Supabase migration:
  - `ALTER TABLE public.instant_messages ALTER COLUMN expires_at DROP NOT
    NULL; ALTER COLUMN expires_at DROP DEFAULT; UPDATE public.instant_messages
    SET expires_at = NULL;`
  - `ALTER TABLE public.instant_rooms ADD COLUMN emptied_at timestamptz,
    ADD COLUMN closed_at timestamptz;`
  - `CREATE OR REPLACE FUNCTION public.sweep_stale_lounges() ...`
  - `SELECT cron.schedule('sweep-stale-lounges', '* * * * *', $$ SELECT
    public.sweep_stale_lounges(); $$);`

No app-code file changes needed unless we add the optional
archived-state banner above.
