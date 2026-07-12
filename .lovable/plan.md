## Simplify Today board to rolling 24h per post

Switch the Today board from local-timezone daily reset to a plain rolling 24-hour window per post. No timezone plumbing, no message cap.

### Behavior
- Each post expires exactly 24 hours after it was created.
- Board shows posts where `expires_at > now()`, newest first.
- No per-user timezone logic anywhere.
- No message cap — a busy city group can post as much as it wants; posts fall off naturally after 24h.

### Changes

**Database (migration)**
- Change `group_today_posts.expires_at` default to `now() + interval '24 hours'` so the column is populated automatically on insert.
- Keep the existing index on `(group_id, expires_at)`; the filter shape doesn't change.
- Existing rows keep whatever `expires_at` they already have (they'll age out naturally).

**Server function** (`src/lib/today-chat.functions.ts`)
- Remove the `tz` input field and the `TZ_RE` validation.
- Remove the `expires_at` computation in the handler — let the DB default handle it.
- Delete `src/lib/today-chat.server.ts` (only `TZ_RE` lived there that's going away; keep `BODY_MAX`, `MENTION_CAP`, `extractMentions` inlined back into `.functions.ts` since the split-transform bug is avoided by not having module-scope helpers referenced by the handler — I'll inline them into the handler scope or a small local const the validator/handler share safely).
- Notification insert logic (`today_mention`) unchanged.

**Client** (`src/components/group/group-today-tab.tsx` and the post composer)
- Stop reading / sending `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Call `postToday({ data: { groupId, body } })` — no `tz`.
- Board query unchanged (still filters `expires_at > now()` server-side via existing RLS/select).

### Out of scope
- No UI copy changes beyond removing any "resets at midnight" hint if one exists.
- No message cap.
- No changes to mentions, notifications, RLS, or the composer's mention popover.

### Why this is the right call
- Zero timezone bugs possible — the recent post failure was caused by tz plumbing.
- Fewer moving parts: DB default does the work, handler shrinks, client drops a field.
- "Today" naturally reads as "the last 24 hours of activity" and stays fresh continuously instead of wiping at a fixed clock time.
