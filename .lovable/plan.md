# Live notification + DM alerts

Both the bell (`notifications-bell.tsx`) and envelope (`messages-inbox-button.tsx`) already render a red count badge. The problem your tester hit is that the badge didn't *appear in real time* when the notification arrived — they only saw it after clicking the bell. There's also no sound.

## What to change

### 1. Notifications bell — make the badge appear instantly
- Confirm the realtime channel is receiving `INSERT`s on `public.notifications` for the current user. If the table isn't in the `supabase_realtime` publication (or replica identity isn't set), the client subscribes but never receives events — that matches the "had to refresh/click to see it" symptom.
- Add a migration that ensures:
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` (idempotent guard)
  - `ALTER TABLE public.notifications REPLICA IDENTITY FULL;`
- Same treatment for `public.messages` and `public.conversations` so the envelope badge updates live too (verify current state first; only add what's missing).

### 2. Pulse the badge on new arrivals
- Bell already lacks the pulse animation the envelope has. Mirror the envelope's `lastUnreadRef` + `pulse` pattern in `notifications-bell.tsx` so the red dot briefly scales in when a new notification lands.

### 3. Play a short sound on new notification / new DM
- Add a tiny reusable helper `src/lib/notify-sound.ts` that plays a short chime via the WebAudio API (no asset download, no autoplay issues once the user has interacted with the page). It will:
  - No-op during SSR / when `document.hidden` is false-y check not needed — play whenever tab is focused or backgrounded; browsers gate autoplay by prior user gesture, which is fine for a logged-in app.
  - Respect a `localStorage` mute flag `notify:muted` so we can add a toggle later without refactor.
- Call it from:
  - `notifications-bell.tsx` inside the realtime `INSERT` handler (only for genuinely new rows, not initial load).
  - `messages-inbox-button.tsx` inside `scheduleReload` when `next > lastUnreadRef.current` (already the pulse trigger — same spot).

### 4. Browser tab title ping (nice-to-have, small)
- When `document.hidden`, prefix the tab title with `(n) ` reflecting total unread (bell + envelope) so the user notices from another tab. Restore on focus. Implement in a small `use-title-badge.ts` hook mounted once in `__root.tsx` alongside the existing providers.

## Out of scope
- No new notification settings UI, no per-kind sound selection, no push notifications — just in-app live badge + sound + tab title.
- No changes to notification content, routing, or the `notifications` server functions.

## Files touched
- `supabase/migrations/<new>.sql` — realtime publication + replica identity (only for tables that need it).
- `src/components/notifications-bell.tsx` — add pulse + sound on realtime INSERT.
- `src/components/messages-inbox-button.tsx` — add sound where pulse already fires.
- `src/lib/notify-sound.ts` — new, WebAudio chime helper.
- `src/hooks/use-title-badge.ts` — new, tab-title unread counter.
- `src/routes/__root.tsx` — mount `useTitleBadge()` once.
