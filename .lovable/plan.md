## Wave 0 — Audit & implementation plan

### Files that will be modified
- `src/routes/groups.index.tsx` — new IA (header → search → kind switcher → optional featured rail → results toolbar → directory → show-more → suggest footer); adds `s` (sort) to `validateSearch`; adds `visibleCount` state; retires imports of the discovery widgets.
- `src/components/group-card.tsx` — restructured to community-first layout (no giant gradient banner, no 4 zero-stats row); accent color used restrainedly; robust for long/multilingual names.
- `src/components/group-card-actions.tsx` — becomes always-visible, keyboard-reachable, mobile-friendly control; owns login/join/leave/loading/toasts; parent decides placement; removes hover-only pattern.
- `src/components/groups-kind-switcher.tsx` **(new)** — one unified taxonomy control with counts; horizontal scroll on mobile, single row on desktop.

### Components retired from `/groups` (removed from route only, files kept until search confirms no consumers)
`SceneTicker`, `FeaturedEventsCompact`, `GroupsTrendingList`, `GroupsBrowseByKind`, `GroupsJoinFeedStrip`, `KickerChip`, `RecapChip`.

### Components shared elsewhere — must remain on disk
Verified via `rg`:
- `FeaturedEventsCompact` → still used by `src/routes/events.index.tsx`.
- `GroupCardCompact` → still used by `adjacent-groups-rail.tsx`, `groups-trending-rail.tsx`, `groups-browse-by-kind.tsx`.
- `KickerChip` / `RecapChip` → still used by `cities.index.tsx`, `collab.index.tsx`, `events.index.tsx`, `signup.tsx`, `login.tsx`, `.lovable.oauth.consent.tsx`.
- `SceneTicker`, `GroupsTrendingList`, `GroupsBrowseByKind`, `GroupsJoinFeedStrip` → only consumer is `groups.index.tsx`. Candidates for Wave 9 deletion after final search confirms no straggling imports; will not be deleted in earlier waves.

### Route-search schema changes
```ts
const searchSchema = z.object({
  t: fallback(z.enum(TAB_VALUES), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  c: fallback(z.enum(CATEGORY_VALUES), "all").default("all"),
  s: fallback(z.enum(["featured","members","content","az"]), "featured").default("featured"),
});
```
`t` values (`for-you`, `all`, `genre`, `scene`, `micro`, `city`) unchanged — only the visible label for `for-you` becomes "Your groups". `c` values unchanged. Existing URLs remain valid; `s` is additive.

### Card structure changes (standard)
```
[avatar] KIND · FEATURED?                              [Join / Joined]
Group name (display, 1 line, truncates gracefully)
Tagline (muted, clamps to 2 lines)
[member avatars ▪ 128 members]      14 works · 3 collabs   (or "New community")
```
- No 80px gradient banner; no oversized decorative icon; no 4-icon zero row.
- Accent color reserved for avatar fallback, small kind chip background, subtle 1px inset ring, hover treatment.
- Featured cards (rail only) keep cover imagery and richer visual treatment.

### Responsive behavior
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (no 4-up).
- Kind switcher: horizontal scroll + snap on mobile, wraps naturally on desktop.
- Featured rail: 3-up desktop; horizontal snap rail (~85vw cards) on mobile.
- Sticky bar height reduced; only search + kind switcher (+ toolbar on scroll) — `top-0` remains valid because `/groups` is a mobile route without the desktop header stacked above the page area (validated in existing implementation).

### Accessibility risks & mitigations
- Card no longer wraps the Join button inside a `<Link>` — parent is `<article>` with a `<Link>` covering only content plus an adjacent absolutely-positioned action (no nested interactive-in-interactive).
- Search input gets `aria-label`; clear button gets `aria-label="Clear search"`.
- Kind buttons use `aria-pressed`.
- Sort/Category use existing shadcn `Select` primitives with associated labels (`sr-only`).
- Focus-visible rings preserved via existing tokens.
- Featured rail is keyboard-scrollable (native overflow, no JS carousel).

### Join-button event-handling risks
- Removing hover-reveal + `stopPropagation` inside a parent `<Link>` requires the card to NOT be a single wrapping `<Link>`. Refactor: `<article className="relative">` with `<Link className="block">` containing card content and a sibling absolutely-positioned `GroupCardActions`. This eliminates nested interactive descendants and the propagation footgun. Existing query invalidations preserved verbatim.

### Testing plan
- Type-check + prod build after each wave.
- Manual: URL round-trip for `t/q/c/s`; search terms (Spanish, Chicago, Writing, Genre, ASL, Filmmakers); sort correctness (featured/members/content/az); featured-rail visibility only when tab=all & q="" & c=all & s=featured; join/leave logged in and logged out; card behavior on 320/375/430/768/1024/1440.
- Playwright screenshots at mobile + desktop for visual regression at the end of Wave 8.

### Delivery sequence (waves)
1. **Wave 1** — Route restructure: drop retired modules, keep header, add prominent search, prepare scaffolding.
2. **Wave 2** — `GroupsKindSwitcher` with live counts; replace tab strip + browse-by-kind.
3. **Wave 3** — Results toolbar: title/count, Category (Select), Sort (Select w/ `s` URL param), Clear filters; contextual titles.
4. **Wave 4** — Standard `GroupCard` redesign.
5. **Wave 5** — `GroupCardActions` restructure + card container refactor.
6. **Wave 6** — Featured Groups rail (conditional, ≤4 items, mobile snap rail).
7. **Wave 7** — Progressive rendering (`PAGE_SIZE=24`, Show More, count reset on filter change).
8. **Wave 8** — Empty/membership states polish, accessibility & responsive QA (Playwright).
9. **Wave 9** — Repository-wide `rg` sweep; delete orphaned files (candidates: `scene-ticker.tsx`, `groups-trending-list.tsx`, `groups-browse-by-kind.tsx`, `groups-join-feed-strip.tsx`) only if no consumers remain; final build.

### Explicitly untouched
- Group DB model / kinds / migrations.
- Group membership tables, `joinGroup`/`leaveGroup` server functions.
- Existing Group URLs (`/g/$slug`) and pages.
- Global top nav, mobile bottom island.
- `useGroupMemberAvatars`, `useMyGroups`, `groups.functions.ts`.
- `FeaturedEventsCompact`, `GroupCardCompact`, `KickerChip`, `RecapChip` component files (still used elsewhere).
- Events / Collabs / Gallery / Blog routes.
- Category values and labels.
- `featured_at` semantics; no new fields.

Ready to begin Wave 1 on approval.
