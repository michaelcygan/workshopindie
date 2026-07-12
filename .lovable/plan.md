## Fix: Today board post fails with `column "timezone" does not exist`

### Root cause
The `BEFORE INSERT` trigger `tg_gtp_set_expiry` on `group_today_posts` reads
`profiles.timezone` — a column that doesn't exist on `profiles`. Every insert
into the Today board fails, regardless of whether the user has a home city
set. Timezone data lives on `cities.timezone`, reachable via
`profiles.home_city_id`.

### Fix (single migration + one server-fn tweak)

**1. Migration — replace `tg_gtp_set_expiry`**

Resolve the author's timezone with a safe fallback chain, never blocking the
post:

- If `NEW.expires_at` was set by the caller (server fn passes the browser's
  IANA zone) → keep it.
- Else look up `cities.timezone` via `profiles.home_city_id`.
- Else fall back to `'UTC'`.
- Compute `expires_at := next_local_midnight_utc(tz)`; cap at `now() + 36h`
  (unchanged safety net).

`next_local_midnight_utc` already coalesces `NULL`/`''` to UTC, so a missing
city can no longer error.

**2. Server fn — `postTodayMessage` accepts an optional `tz`**

- Add `tz: z.string().max(64).optional()` to the input.
- In the handler, if `tz` is provided and looks like a valid IANA zone
  (`Intl.supportedValuesOf('timeZone').includes(tz)` on the server, or a
  simple regex guard), compute `expires_at` via a small SQL call
  (`select next_local_midnight_utc($1)`) and pass it on the insert.
- If `tz` is missing/invalid, insert without `expires_at` and let the fixed
  trigger resolve it (home city → UTC).

**3. Client — send the browser timezone**

In `group-today-tab.tsx`, pass
`tz: Intl.DateTimeFormat().resolvedOptions().timeZone` in the
`postTodayMessage` call. This makes "messages clear at midnight, your time"
true for everyone — even users without a home city set.

### Not changing
- Table schema, RLS policies, indexes, and rate-limit trigger stay as-is.
- No client UI changes beyond the one added field on the mutation call.
- Lounge flow untouched.

### Files
- New migration: fixed `tg_gtp_set_expiry` definition.
- `src/lib/today-chat.functions.ts`: accept `tz`, compute `expires_at`
  server-side when provided.
- `src/components/group/group-today-tab.tsx`: send browser tz on post.