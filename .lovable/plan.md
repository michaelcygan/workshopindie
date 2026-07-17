## What I found so far

- The Today composer calls `postTodayMessage` (`src/lib/today-chat.functions.ts`), which inserts into `group_today_posts` after a member check.
- On success, the mutation in `src/components/group/group-today-tab.tsx` clears the input (`setBody("")`) — this explains "my message is deleted": the client thinks the call succeeded.
- The list query filters `.gt("expires_at", now())`. The BEFORE INSERT trigger `tg_gtp_set_expiry` sets `expires_at` via `next_local_midnight_utc(profile.home_city timezone)`, which always returns a future timestamp — so a successful insert should be visible.
- There are three BEFORE INSERT triggers on `group_today_posts`: `gtp_set_expiry`, `tg_group_today_posts_rate_limit` (5 posts / 10s), and `trg_moderate_group_today_posts` (raises `moderation_block` via `moderation_text_is_blocked`).
- The last row in the Chicago group is from 2026‑07‑16; nothing from today. No postgres ERROR logs mention `group_today_posts` in the recent window, and no worker logs for `postTodayMessage` are captured in the last hour. That means either the request never hit the worker, or it was recorded before the log window.
- No client console/network entries for the composer are present in the current snapshot (user is on `/groups`, not the group page).

Root cause is not yet confirmed. I want to add just enough instrumentation to surface the exact failure the next time the user hits Send, then fix that cause.

## Plan

1. **Surface real errors in the composer.** In `src/components/group/group-today-tab.tsx`, delay clearing the input until we've confirmed a server response, log the server error to console with a stable prefix (`[today-post]`), and make the toast show the underlying message (RLS, moderation, rate‑limit) instead of a generic string.
2. **Add server-side logging + moderation compliance.** In `postTodayMessage`:
   - Wrap the insert with a `console.error("[today-post]", …)` on failure so the worker log names the exact Postgres error (RLS `42501`, moderation `moderation_block`, rate limit, etc.).
   - Route the body through `moderateOrThrow` from `@/lib/moderation/service.server` before insert (this is the project's Core rule for user‑generated text; the DB trigger stays as the last line of defense). This also gives us a clean, user‑facing "message blocked" toast instead of a Postgres exception surfacing raw.
3. **Reproduce and confirm.** After (1) and (2) ship, ask the user to try posting once more in Chicago Today. Read `server-function-logs` for `[today-post]` and read the client console to identify which of these it is:
   - RLS INSERT blocked (would mean `is_adult` / membership issue — user profile currently passes both, so unlikely but possible if session cookie is stale).
   - Moderation block on the specific words typed.
   - Rate limiter tripped.
   - Something else entirely (e.g. mentions notification write failing before we swallow it — currently we only swallow in the mentions block; a JSON/enum mismatch elsewhere would bubble).
4. **Ship the targeted fix.** Based on the log, apply the minimal fix: adjust the trigger, relax a check, or correct a serialization bug. No speculative changes before the diagnostic pass.

## Notes / non‑goals

- No schema changes on `group_today_posts` in this pass — triggers and policies look correct on paper.
- No changes to the realtime subscription, expiry logic, or the desktop/mobile layout.
- All changes stay inside the composer component + the one server function.
