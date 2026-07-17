## Mobile Lounge selector — focused hierarchy pass

Mobile only (`<md`). Desktop split layout, full topic scroller, marquee, and rail cards stay exactly as they are.

### 1. Shorten the mobile topic list — `src/components/live-topics-list.tsx` (stack branch only)

- Compute a `mobileVisible` list capped at 5 category rows using existing `sorted` + `liveByMedium`:
  1. Start with categories where `liveByMedium.get(id) > 0`, ordered by count desc.
  2. Append `critique`, then `coworking`.
  3. Fill from `sorted` in order until 5.
  4. Dedupe by id.
- Add local `const [expanded, setExpanded] = useState(false)`.
- Render `loungeRow` + (`expanded ? sorted : mobileVisible`).
- Below the list, render a quiet full-width button: "View all topics (N)" ⇄ "Show fewer", min-height 44px, subtle border-top, no icon-heavy styling. Toggles `expanded`. Only rendered when `sorted.length > mobileVisible.length`.
- No changes to `TopicRow`, `onPick`, `onPickFlavor`, sub-options, or the split branch.

### 2. Compact mobile "Live now" rail — `src/components/live-workshops-rail.tsx`

- Add a `variant?: "cards" | "compact-pills"` prop (default `"cards"` — preserves desktop).
- When `variant === "compact-pills"`:
  - Reuse the existing `["instant-active-rooms"]` query, `joinSpecificInstantRoom`, and `onTakeSeat` flow already in the file — no new query, no new server fn.
  - Render a single horizontally scrollable row (`overflow-x-auto snap-x scrollbar-none`) of pill cards, one per joinable room.
  - Each pill: room title (truncate), small topic dot + label, up to 3 stacked participant avatars (reuse existing avatar rendering), `count/5` seat text. Min height 44px, min tap width ~200px.
  - If the filtered list is empty → return `null` (parent decides layout).
- No changes to the desktop `"cards"` branch.

### 3. Wire the compact rail into `src/routes/lounge.index.tsx`

- Move the existing `<LiveWorkshopsRail>` to render **above** the topic list on mobile only, wrapped in `md:hidden`, with `variant="compact-pills"`. Show a small "Live now · N" eyebrow above it. Omit entirely when no rooms.
- Keep the current desktop `<LiveWorkshopsRail>` block as-is, wrapped in `hidden md:block` (currently unconstrained — this narrows it to desktop so we don't double-render).
- `onTakeSeat` and `canJoin` behavior unchanged (still uses `preGrantMedia`).

### 4. Mobile quick-start pills — `src/components/room-prompt-marquee.tsx`

- Add `variant?: "marquee" | "static-row"` (default `"marquee"` — desktop unchanged).
- When `variant === "static-row"`:
  - Pick ~6 curated prompts from the existing `ROOM_PROMPTS` export by exact `title` match: "Heads-down work session", "Portfolio review", "Mix feedback — bring stems", "Co-writing sprint", "Pair-program on a bug", "Dailies critique". Filter to those actually present; no new data.
  - Render as a single horizontally scrollable, non-animated row of pills (`overflow-x-auto snap-x scrollbar-none`), each ≥44px tall.
  - Keep the existing tap behavior: if `liveByMedium.get(prompt.medium) > 0` → confirm "Join a live one" → `onJoinLive(medium)`; else → "Start now" → `onUsePrompt(prompt)`. Reuse the current confirm popover/logic — don't fork it.
- In `lounge.index.tsx`, pass `variant="static-row"` only for the mobile `LiveTopicsList`'s `featuredFooter`; the desktop instance keeps the marquee.

### 5. Mobile page order in `lounge.index.tsx` (`md:hidden` block)

1. Header + subtitle (unchanged)
2. `SplitOpenButton` / "Match me to a seat" (already inside `LiveTopicsList` featured section — keep)
3. New compact `LiveWorkshopsRail variant="compact-pills"` (only when rooms exist)
4. Shortened topic list + "View all topics"
5. Quick-start static-row pills (as `featuredFooter`)
6. Host strip + fine print (unchanged)

### Constraints honored

- Single React Query key `["instant-active-rooms"]` — no new fetchers.
- `onPick → handlePick → joinLounge/joinMediumLounge` untouched.
- No auto-motion on mobile (no marquee, no auto-scroll).
- Horizontal scroll confined to the two pill rows; page stays vertical.
- 44px tap targets on all new controls; overflow tested mentally at 320–430px.
- Desktop code paths are gated behind existing `md:` wrappers and new `variant` defaults.
- No schema, route, Supabase, or media-permission changes.

### Files touched

- `src/components/live-topics-list.tsx` — stack branch: mobileVisible cap + expand toggle.
- `src/components/live-workshops-rail.tsx` — add `compact-pills` variant.
- `src/components/room-prompt-marquee.tsx` — add `static-row` variant.
- `src/routes/lounge.index.tsx` — reorder mobile block, gate desktop rail, pass new variants.
