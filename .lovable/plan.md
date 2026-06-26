
## Today tab polish + group page scale pass

### 1. Today layout refresh (after news ticker moved out)

Rework `src/components/group/group-today-tab.tsx` into a 3-rail composition:

```text
┌─────────────────────────────────────────┬────────────────┐
│  Today chat (taller — ~70vh)            │  Next event    │
│  - header w/ live count                 │  (single card) │
│  - messages w/ @mentions + link parsing │                │
│  - sticky composer                      │ ───────────────│
│                                         │  Fresh collabs │
└─────────────────────────────────────────┴────────────────┘
```

- Chat height: bump scroller to `h-[calc(100vh-22rem)] min-h-[480px] max-h-[72vh]`.
- Right rail order: **Next event → Fresh collabs**.

### 2. Next event module (new)

New component `src/components/group/group-next-event.tsx`:
- Query `group_events` for `group_id = group.id` AND `starts_at >= now()`, ordered ascending, **limit 1**. (Not constrained to "today" — just the soonest upcoming one.)
- Shows a single card: title, date+time in viewer TZ ("Sat, Jul 4 · 7:30 PM" + relative "in 3 days"), going count, link to `g/$slug/e/$eventSlug`.
- Empty state: "No upcoming events." + "Post one →" deep link to the group-scoped event create flow.
- Small "All events →" link to the group's Events tab footer of the card.

### 3. @mentions for users — with notifications

Composer changes in `TodayChat`:
- Replace `<input>` with auto-resizing `<textarea>` (Enter to send, Shift+Enter newline).
- New `MentionAutocomplete` popover at `src/components/group/today-mention-popover.tsx`:
  - Trigger: detect `@` at cursor, capture token until whitespace.
  - Source: group members from `profiles` joined to `group_members`, `ilike` username/display_name, limit 6.
  - Insert plain `@username` token.

Rendering:
- Parse body into segments (text | mention | url | collab-link), render mentions as `<Link to="/u/$username">` chips.

Notifications — new server fn `postTodayMessage` in `src/lib/today-chat.functions.ts`:
- Inserts the post, extracts `@username` tokens, resolves to user IDs (filter out author, dupes, non-members), inserts `notifications` rows with `kind = 'today_mention'`, `entity_type = 'group_today_post'`, `entity_id = postId`, `payload = { group_slug, group_name, snippet }`.
- Cap at 10 mentions/post.

### 4. @mentions for your own collabs

Same popover, second section:
- Also queries `collab_posts where author_id = me and status = 'open'` (limit 6) and shows under a "Your collabs" divider.
- Inserted as markdown link `[Title](/collab/slug)` — no schema change required.
- Renderer detects `[label](/collab/...)` and renders an inline pill (📣 icon + title).

### 5. Clickable links + soft censoring

Shared util `src/lib/today-text.tsx` exporting `renderTodayBody(body)`:
- Tokenize into text / mention / url / collab-link.
- URLs auto-linked with `rel="noopener noreferrer nofollow ugc"` + `target="_blank"`.
- Censor list in `src/lib/link-blocklist.ts` (pornhub.com, xvideos.com, onlyfans.com, etc.). Matching hosts render as muted non-clickable chip: "link hidden · adult content".
- Shorteners (bit.ly, t.co) get a ⚠︎ prefix but stay clickable.
- Visible URL text truncated to 60 chars.

### 6. Scale to 100k concurrent — group page hardening

**Realtime**
- Replace per-viewer `postgres_changes` subscription on `group_today_posts` and `group_today_pins` with a Supabase **broadcast** channel `group:{id}:today`. The post server fn emits the broadcast after insert. Postgres-changes fan-out doesn't survive 100k DAU; broadcast does.
- On broadcast receipt, append the payload locally instead of re-querying (no thundering herd).

**Read path / indexes (migration)**
- `group_today_posts (group_id, expires_at desc)`
- `group_today_pins (group_id, expires_at desc)`
- `group_events (group_id, starts_at)` — covers next-event lookup
- `notifications (user_id, read_at, created_at desc)` partial on `read_at is null`
- Switch chat fetch to keyset pagination (initial 50, load older on scroll-top).

**Write path / abuse**
- DB trigger `tg_group_today_posts_rate_limit`: reject >5 posts / 10s per user per group.
- Server-side trim; reject pure-whitespace.

**Caching**
- TanStack Query: group hero/about `staleTime: 5m`, `gcTime: 30m`.
- News ticker server fn: per-URL in-memory memo, 5 min TTL.

### 7. Files touched

New:
- `src/components/group/group-next-event.tsx`
- `src/components/group/today-mention-popover.tsx`
- `src/lib/today-text.tsx`
- `src/lib/link-blocklist.ts`
- `src/lib/today-chat.functions.ts`
- One migration (indexes + rate-limit trigger)

Edited:
- `src/components/group/group-today-tab.tsx` (layout, taller chat, textarea+autocomplete, shared renderer, broadcast, server fn)
- `src/lib/group-news.functions.ts` (TTL memoize)

### Out of scope

- No new notification UI surface — uses existing notification center.
- No moderation queue for censored links (silent hide + report).
- No rich-text editor — plain text + parser.
