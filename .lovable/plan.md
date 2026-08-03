## Wave 3 — Navigation, Home, and legacy Lounge routes

Finishes the consolidation: Groups become the destination, Lounge stays as infrastructure and compatibility only. No table changes, no deletion of realtime code.

### 1. Navigation

**`src/components/top-nav.tsx`** — remove the `/lounge` primary nav link (currently the first item, carrying `data-firstrun="instant"`). Groups moves into that first slot; move the `data-firstrun` hook onto the Groups item so the first-run tour still has an anchor. Order becomes Groups · Collabs · More.

**`src/components/mobile-island/mobile-tabs-config.ts`** — replace the `lounge` tab (`/lounge`, `Radio`) with a `groups` entry (`/groups`, `Users`) on the left side, keeping the existing four-slot layout. Tab id union updates accordingly.

**`src/components/mobile-island/use-active-tab.ts`** — `/lounge` and `/lounge/*` no longer map to a tab; `/g/*` and `/groups` map to `groups`.

**`src/components/site-footer.tsx`** — drop the Lounge link from the public Explore list (line ~137). Keep the `/lounge/` hide-footer path rule intact, since rooms still render.

**`src/components/welcome-tour.tsx`** — the "Drop into a live Lounge" step becomes a Groups step pointing at `/groups`, described as joining a scene where Today chat and audio live.

### 2. Home "Pulse" row

**`src/components/home-pulse-rail.tsx`** — the only Lounge surface here is the `from_workshop ? "from Lounge"` label. Relabel to "from a Group session" so Pulse stops advertising Lounge as a destination; the underlying `from_workshop` derivation is unchanged.

**`src/components/home/now-module.tsx`** — the live row currently links to `/lounge/$id` and falls back to "Open a Lounge" → `/lounge`. Repoint both at Groups: an active session links to its group (`/g/$slug`, using `HomeLounge.groupSlug`), and the empty state becomes "Open a Group" → `/groups`. If `HomeLounge` does not already carry a group slug, add it in `myGroupLoungesServer()` in `src/lib/home.server.ts` (the rows already join `instant_rooms.group_id`) and to the `HomeLounge` type in `src/lib/home-types.ts`.

### 3. Legacy `/lounge` routes

Both routes stay on disk — external links, invites, and notifications still point at them.

**`src/routes/lounge.index.tsx`** — keep the route, but make it a redirect surface rather than a competing destination: `beforeLoad` issues `redirect({ to: "/groups" })`. The existing matchmaking UI (`joinLounge`, `LiveTopicsList`, `GroupLoungesRail`, etc.) is left in the file's history but no longer rendered from this path; the server fns it calls remain untouched for Group audio.

**`src/routes/lounge.$id.tsx`** — keep the room fully functional (Group audio dock currently depends on the same realtime stack), but add a soft compatibility redirect: on load, look up the room's `group_id`; when set, redirect to that group's page so the group owns the experience. Rooms with no `group_id` (legacy/instant/collab-spawned) continue to render in place exactly as today.

**Metadata** — `/lounge` head copy no longer advertises a standalone product; title/description shift to a short "Redirecting to Groups" framing with `robots: noindex`, so search results stop surfacing Lounge as a top-level destination.

### Out of scope (explicitly untouched)

`use-stream-lounge-audio.ts`, `stream-lounge-provider.tsx`, `lounge-access.*`, `lounge-telemetry.*`, `lounge-constants.ts`, `lounge-invite*`, `channel-view.tsx`, `instant_*` tables and RPCs, and every Group audio file added in Waves 1–2. Signed-in Group behavior from Wave 2 is unchanged.

### Verification

Typecheck with `tsgo`, Prettier + ESLint on changed files only, then a Playwright pass: anonymous and signed-in nav render without Lounge; `/lounge` redirects to `/groups`; a group-backed `/lounge/$id` lands on its group; a non-group room still opens; mobile island shows the Groups tab and highlights it on `/g/*`; no console errors.

### Files expected to change

`src/components/top-nav.tsx`, `src/components/mobile-island/mobile-tabs-config.ts`, `src/components/mobile-island/use-active-tab.ts`, `src/components/site-footer.tsx`, `src/components/welcome-tour.tsx`, `src/components/home-pulse-rail.tsx`, `src/components/home/now-module.tsx`, `src/lib/home.server.ts`, `src/lib/home-types.ts`, `src/routes/lounge.index.tsx`, `src/routes/lounge.$id.tsx`.
