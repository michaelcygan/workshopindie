## Wall polish pass

Low-intensity upgrades to the event Wall.

### 1. Reorder tabs — Wall first
In `src/routes/g.$slug.e.$eventSlug.tsx`, put **Wall** first in `TabsList` and set `defaultValue="wall"`. Order becomes: Wall · About · (Lineup).

### 2. ❤️ Likes on wall posts
- New table `public.group_event_comment_reactions(comment_id, user_id, emoji, created_at)` with `UNIQUE(comment_id, user_id, emoji)`, RLS, GRANTs. Start single-emoji (❤️) to stay low-intensity.
- Extend `listEventComments` to return `like_count` + `liked_by_me`.
- Add `toggleEventCommentLike` server fn.
- In `event-wall.tsx`, render a tiny heart button + count under each post. Frozen (read-only) once the wall seals.

### 3. Mentions in the composer
Replace the plain `Textarea` in `event-wall.tsx` with the existing `ChatMentionInput` (used in Lounge/Group Today). Gives `@user` typeahead (attendees prioritized) and `@collab / @group / @work / @event` internal-link chips. Render posts through `MessageBody` so chips + hover peeks work.

### 4. Time-boxed photo uploads on the Wall
Backend already exists (`event_photos`, `event-photos` bucket, `EventPhotosSection` with lightbox + prev/next arrows already implemented).
- Add server-side window guard in `recordEventPhoto`: allow only when `now() BETWEEN starts_at - 2h AND ends_at + 3 days` (interval configurable). Client hides uploader outside window.
- Inline a compact photo strip inside the Wall tab (thumbnail row + "Add photo" button), reusing `EventPhotosSection`. Existing lightbox already supports ‹ / › navigation and Esc-to-close — no changes needed there.

### 5. Wall sealing (3 days after `ends_at`)
- Composer hides → "Wall sealed — thanks for coming."
- Likes freeze (button becomes non-interactive; existing likes still shown).
- Photo uploads blocked (viewing stays open).
- Server enforces on `postEventComment`, `toggleEventCommentLike`, `recordEventPhoto`.

### 6. Auto-posted system messages
On event start and event end, insert a system row into `group_event_comments` (nullable `author_id` + `system_kind` column: `started` / `wrapped`). Rendered as a centered chip in the Wall, not a normal message.
- Written by the existing daily rolling-events `pg_cron` job (extended to also emit start/end markers within the last hour), or a dedicated hourly sweep at `/api/public/events.wall-system.ts`.

### 7. Notifications
When someone posts on a wall, notify **everyone RSVP'd going (and the host/cohosts)** except the poster and anyone with wall notifications muted. Uses existing `notifications` + `notification_preferences` plumbing; add a new `event_wall_post` kind with a preference toggle. Batch to avoid duplicates within a short window.

### 8. Wall summary chip on About tab
Small pill in About header: "💬 N posts · 📷 M photos · ❤️ K likes" — links back to the Wall tab. Cheap counts via the same queries.

### What I'm skipping (per "low-intensity")
Threaded replies, multiple reaction emojis, editing, photo captions, per-post notification opt-outs.

### Files touched
- `src/routes/g.$slug.e.$eventSlug.tsx` — tab reorder + default, summary chip
- `src/components/event-wall.tsx` — mention input, MessageBody rendering, like button, inline photo strip, sealed state
- `src/lib/group-events.functions.ts` — like count fields on list, `toggleEventCommentLike`, seal guards, `system_kind` handling
- `src/lib/event-photos.functions.ts` — window guard in `recordEventPhoto`
- `src/lib/notifications.functions.ts` (or inline) — fanout for `event_wall_post`
- `src/routes/api/public/events.wall-system.ts` — hourly sweep for start/end markers + pg_cron entry
- Migration: `group_event_comment_reactions`, `group_event_comments.system_kind` column + nullable `author_id`, `notification_preferences.event_wall_post` toggle

### Confirmations
Defaults I'll use unless you say otherwise:
- Seal window: **3 days after `ends_at`**.
- Upload window opens **2h before `starts_at`**.
- Notification fanout: **all RSVP'd going + cohosts**, poster excluded, respects existing mute prefs.
- Single like emoji (❤️).