## Fix: Lounge fullscreen crash — "cannot add postgres_changes callbacks after subscribe()"

### Root cause
`useRoomPinsAndScreening` (in `src/components/pinned-screening-strip.tsx`) opens a Supabase realtime channel named `room-work-pins-strip:${roomId}`. When fullscreen mounts, a second `PinnedScreeningStrip` renders while the non-fullscreen one is still mounted (and React StrictMode also double-invokes effects). Supabase reuses the channel by name, so the second hook calls `.on("postgres_changes", …)` on a channel that's already `subscribe()`d — which throws and trips the Lounge error boundary ("Lounge hit a snag").

### Fix
Make the channel name unique per hook instance so each mount owns its own channel.

- In `src/components/pinned-screening-strip.tsx` → `useRoomPinsAndScreening`:
  - Generate a per-instance id with `useId()` (or `useRef(crypto.randomUUID())`).
  - Change channel name to `` `room-work-pins-strip:${roomId}:${instanceId}` ``.
  - Keep the existing `.on(...).subscribe()` order and the cleanup `supabase.removeChannel(ch)`.

### Optional hardening (same file, same edit)
- Guard against React StrictMode double-effect by creating the channel inside the effect only (already the case) — no other changes needed.

### Out of scope
- No DB, RLS, or server-function changes.
- No changes to `ScreeningStage`, `channel-view.tsx`, or `media-panel.tsx`.
- No changes to the Lounge error boundary copy.

### Verification
- Enter a Lounge, click fullscreen — no crash, pinned strip renders in both places, realtime pin add/remove still updates live in both.
