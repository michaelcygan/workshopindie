## Goal
Today-board `@` mentions already write a `today_mention` notification row on the server, but the notifications bell has no case for that kind — so it renders as the literal string "today_mention" with a generic bell icon and links to `/me`. This makes it look like the feature isn't wired up. Fix the inbox side so tagged users see a proper notification card that jumps to the Today board.

## Changes

**`src/components/notifications-bell.tsx`** — presentation only.

1. Register an icon for `today_mention` in the `ICONS` map (reuse `MessageCircle`, matching `chat_mention`).
2. Add a `case "today_mention"` branch in `labelFor()` that reads `payload.group_slug`, `payload.group_name`, `payload.snippet` (already set by `postTodayMessage`):
   - **title**: `` `${actor} tagged you in ${groupName}'s Today board` ``
   - **subtitle**: the snippet
   - **href**: `/g/${group_slug}` when present, else `/groups`

No server, DB, RLS, or `today-chat.functions.ts` changes — the insert already runs, restricts targets to current group members, and skips self-mentions.

## Out of scope
- Deep-linking to a specific post (Today posts don't have per-post routes; the group page is the right landing).
- Notification preference toggle for Today mentions (piggybacks on the existing mentions channel).
- Expanding to Group/Event/Collab tag notifications — those remain discovery-only per the earlier decision.