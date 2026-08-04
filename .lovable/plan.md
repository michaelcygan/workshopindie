# Live "Now" board for the logged-in desktop homepage

Turn the three static status cards on the member homepage into a compact, continuously updating three-lane board — Live / Make / Explore — inspired by an airport arrivals board. Desktop (lg and up) only; the current mobile Now module stays exactly as it is.

## What's there today

- `member-home.tsx` renders `NowModule` from a single `getMemberHome` payload (`useQuery`, `staleTime: 60_000`, no refetch interval).
- `NowModule` shows three fixed rows: top Today group, top active audio room, next Event.
- `home.server.ts` already returns Today summaries, active rooms with presence counts, next Event, continue actions, groups, circle, people, mediums, and reads `home_city_id` from the profile (it is not currently returned to the client).
- Today groups are ranked by `postCount` only.
- Active rooms come from `instant_rooms` with a presence-derived `liveCount` (sorted by count, but rooms with zero live members can still surface).
- `createMyBlogDraft` accepts an optional `seedTag` and already returns `{ id, reused }` when the draft limit forces reuse of an existing draft.
- `/collab/new` search schema accepts `group` and legacy `fromLounge`.
- Route search contracts confirmed: `/gallery` (`cat`, `city`, `sort`), `/collab` (`cat`, `city` uuid, `cityName`, `online`), `/events` (`when`, `format`, `city` uuid, `cityName`, `mine`).
- `framer-motion` is already a dependency. There is no general client analytics helper (only `admin-analytics.functions.ts`), so analytics is deferred.

## Wave 1 — Data contract and truthful activity

1. `home-types.ts`: add to `MemberHomePayload`
   - `homeCity: { id, name, slug } | null`
   - `homeCityGroup: { id, name, slug } | null`
   - `nowGroups: Array<{ id, name, slug }>`
   - `mediums: string[]`
   - `upcomingEvents: HomeEvent[]` (several ranked candidates; `nextEvent` stays for mobile)
   - Optional `hasWork` / `hasGroups`-style booleans only if not already derivable.
2. `home.server.ts`
   - Resolve the home city row (and a matching public city Group when one exists) from the existing `home_city_id`; each resolution is its own `allSettled` branch so a failure falls back to global suggestions.
   - Return active audio rooms with a truthful `live` distinction: only `liveCount > 0` counts as live; zero-presence rooms are returned as "start audio" candidates.
   - Rank Today by recency and volume together (recency-weighted score over `latestAt` plus `postCount`) instead of `postCount` alone.
   - Widen the Event query to return several ranked candidates (rsvp > joined group > home city > online); keep `nextEvent` as the first one.
3. New client-safe `src/lib/home-now-types.ts` with `HomeNowLane`, `HomeNowSource`, `HomeNowAction` (discriminated union: `blog-prompt`, `collab-prompt`), and `HomeNowItem` using TanStack-safe `to`/`params`/`search`.
4. Mobile `NowModule` unchanged. Build.

## Wave 2 — The desktop board and suggestion engine

1. `src/lib/home-now-suggestions.ts` — curated, deterministic catalog of 100+ items across publishing Work, Blog/editorial prompts, process notes, WIP, Collabs, feedback, Group/Today, Group audio, local, medium, network, Events, weekend and time-boxed exercises. Each entry: stable id, lane, copy, destination or allowlisted action, eligibility predicate, weight, optional day/time window, cooldown, and `{city} {medium} {group} {work} {daypart}` substitution (an item is dropped when its context is missing — no broken placeholders). Existing `TODAY_PROMPTS` entries are adapted where they fit rather than duplicated.
2. `src/lib/home-now-select.ts` — builds candidates from the payload (real activity → personal continue actions → personalized contextual → evergreen seed), applies eligibility, deterministic seeded shuffle (seeded once per session, never `Math.random()` at render), per-lane dedupe, cross-lane dedupe, and a `sessionStorage` recently-shown cooldown. Every lane is guaranteed non-empty via evergreen fallbacks.
3. `src/components/home/now-board-desktop.tsx` — near-black board surface, warm-white text, cobalt only for live/active/selected, Archivo titles, Inter utility text, hairline dividers, ~10px radius, fixed ~180px height, three equal columns, clamped title/detail so height never changes. Header status line `NOW · CHICAGO · UPDATED 8:55 PM` (city only when resolved). Small prev / pause-play / next controls with proper labels.
4. Rotation: framer-motion short rotateX/translateY transition, 300–450ms; lanes rotate every ~11s, staggered 0s / 2s / 4s. Pauses on hover, focus-within, and hidden tab; manual pause/play; `prefers-reduced-motion` disables auto-flip and 3D while keeping manual controls. No live-region spam; only one link per item (no nested interactive elements). A single genuine live item stays put; multiple live items rotate.
5. `member-home.tsx`: `NowModule` in a `lg:hidden` wrapper, `NowBoardDesktop` in `hidden lg:block`, both fed from the same query. Fixed-height skeleton for the board.
6. Verify 1024 / 1280 / 1440 and unchanged mobile; build and lint.

## Wave 3 — Live refresh and prompted creation

1. Member-home query: `refetchInterval` ~45s while visible, `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchIntervalInBackground: false`.
2. Narrow Realtime: one channel for `group_today_posts` filtered to joined groups and one for active room state, both debounced (~3–5s) before invalidating the member-home key, torn down on unmount. No global `instant_presence` subscription; presence freshness rides the poll. Realtime failure silently falls back to polling.
3. Blog prompts: extend `createMyBlogDraft` with an optional allowlisted `seedPromptId` (Zod enum) mapped server-side to a safe title/starter body. Reused drafts (`reused: true`) are never overwritten — navigate to them and surface a quiet "opened your current draft" toast. Creation happens only on explicit click, never on rotation. All existing access, moderation, rate-limit, and Plus behavior preserved.
4. Collab prompts: add an allowlisted `prompt` enum to the `/collab/new` search schema (`weekend-short-film`, `one-night-remix`, `portfolio-feedback-swap`, `table-read`, `photo-walk`); the composer prefills empty fields on first mount only, inserts nothing until submit, and all caps/gates/validation stay intact.
5. Accessibility and regression QA; build and lint.

## Guardrails

- No migrations, no RLS changes, no new dependencies, no new routes, no AI generation, no admin CMS.
- No Lounge language or links to the retired `/lounge` index; audio suggestions link to `/g/$slug`.
- Never claim live without `liveCount > 0`; fallback lane is labeled `RIGHT NOW`/`START`, not `LIVE`.
- Public homepage, mobile Now, Groups, Today, audio transport, Blog/Collab publishing, Gallery, Events, Profiles and auth untouched.
- Fault isolation preserved: any one section failing must not blank the board or the homepage.
- Analytics deferred — no suitable lightweight client primitive exists and adding one is out of scope.
