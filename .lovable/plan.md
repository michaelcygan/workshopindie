# Workshop join module — dynamic pass

Goal: make the join surface self-describing and alive, so a first-time visitor instantly grasps what the platform is for and what a room could become.

Scope is purely the `/workshop` discovery module. No backend, no routing, no schema changes. All work lives in `src/components/live-topics-list.tsx`, a small new `src/components/room-prompt-marquee.tsx`, and a touch of `src/routes/workshop.index.tsx`.

---

## 1. Topic descriptions (hover-reveal, no layout shift)

Each topic row gets a one-line description that lives in a collapsed slot beneath the label. On hover/focus the slot expands with a height/opacity transition. Closed rows stay the same height as today — no jumping when the mouse moves.

Descriptions (short, evocative, category-true):
- **Film** — Writers' rooms, edit jams, dailies critique.
- **Music** — Beat cooks, vocal sessions, mix feedback.
- **Writing** — Co-writing sprints, prose critique, lyric labs.
- **Build** — Pair-program, hackathons, design reviews.
- **Visual** — Figure drawing, photo critique, illustration jams.
- **Critique** — Drop a Work, get five sharp minds on it. *(also: medium dropdown)*
- **Business of Art** — Pricing, deals, distribution, taxes — bring questions.
- **Co-working** — Cameras on, mics off. Get work done with company. *(also: medium dropdown)*

## 2. Sub-medium dropdown on Critique & Co-working

The two cross-cutting topics get a small chevron affordance to the right of the label. Clicking it (without triggering the row) opens a popover with the five Work mediums (`film, music, writing, build, visual`).

- Picking a sub-medium calls the same `onPick` path with the chosen medium so matchmaker funnels into the right pool. We extend `onPick` to optionally accept a `{ medium, parent: 'critique' | 'coworking' }` shape — entirely client-side; the room is still created via the existing matchmaker RPC using `medium`.
- Click on the row body still works as today (joins generic Critique / Co-working).
- Popover uses existing shadcn `Popover` for accessibility (Esc to close, focus trap).

## 3. Idle auto-scroll of the topic list

After **4 seconds of no mouse/keyboard interaction** with the list, the topic column begins a very slow vertical scroll (~12 px/s), looping back to the top when it reaches the bottom. Any hover, focus, scroll, click, or keydown on the panel pauses immediately and resets the idle timer. We respect `prefers-reduced-motion`: users with it set never get the auto-scroll.

Implementation: `useEffect` ticker on a `ref` to the `<ul>`, `requestAnimationFrame` increments `scrollTop`, listeners pause on `pointerenter`, `focusin`, `wheel`, `keydown`.

## 4. "Room name" marquee under Any topic

Beneath the "Open the first room / Match me to a seat" CTA, add 2 rows of slow horizontal marquees of pre-filled room name suggestions. Each chip is **clickable** — tapping it pre-fills the host dialog with that title and (when obvious) the matching medium, then opens the privacy dialog. This turns the marquee from decoration into the fastest path to "I get it — let me try one."

- Two rows scroll in opposite directions at ~25s loop, paused on hover.
- Subtle gradient mask on left/right edges so chips fade rather than clip.
- `prefers-reduced-motion`: marquees freeze, chips stay tappable (grid wrap).
- Pulls from a curated `ROOM_PROMPTS` array (below). We surface ~24 at a time, shuffled per mount so it feels alive on each visit.

Wiring: `workshop.index.tsx` passes an `onUsePrompt(prompt)` handler that sets `pendingTitle`/`pendingMedium` and opens `HostPrivacyDialog`. We extend `HostPrivacyDialog` props with `defaultTitle` (already supports `defaultMedium`).

### Curated prompts (medium-tagged)

Film — Short film writers' room · Dailies critique, bring 90 sec · Edit jam: cut my opening · Doc pitch polish · Music video treatment swap · Storyboard speedrun
Music — 1 hyperpop song an hour, all day · Trap bootcamp, 1 hr · Need a vocalist for a tech house song · Beat cook-off, 5 producers · Mix feedback, bring stems · Lyric writing sprint
Writing — 6 hr co-writing sprint · Short story critique, 2k words max · Poetry round-robin · Screenplay table read · Cold-open writers' room · Newsletter editing swap
Build — Mental health hackathon · Ship-a-feature-in-an-hour · Design review: my landing page · Pair on a weird bug · Build-in-public co-working · Solo founder accountability
Visual — Figure drawing from references · Photo critique, 5 shots each · Illustration jam: same prompt, 30 min · Concept art swap · Type-design crit · Color study hour
Critique — Bring one Work, leave with a list · Pitch your loglines · Rapid portfolio review · Honest opinions only
Business — Pricing your first commission · Cold email teardown · Contract review, BYO doc · How I got my first $1k
Co-working — Cameras on, mics off, 2 hours · Morning pages, then heads-down · Late-night ship sprint · Sunday reset & plan the week

## 5. Code quality bar

- One new component `RoomPromptMarquee` (≤120 lines) that owns the marquee animation and a tiny `Prompt` chip subcomponent. No external marquee dep — pure CSS keyframes parameterised by row.
- Topic descriptions and prompts move into `src/lib/topic-prompts.ts` so categories.ts stays a clean taxonomy.
- All new motion respects `prefers-reduced-motion`; all new interactive elements get `aria-label`s and visible focus rings consistent with existing rows.
- No new dependencies. No backend or schema changes. No changes to the matchmaker RPC.

## Technical notes

- `LiveTopicsList` `onPick` signature stays `(medium: Category | null) => void`; sub-medium picks just pass the chosen Work medium — server side doesn't care it came from Critique vs Co-working.
- Marquee uses two stacked `<div>`s with `animation: marquee-x 25s linear infinite` and a duplicated child list so the loop is seamless. Animation paused via `[data-paused="true"]`.
- Idle scroller stores `lastInteractionAt` in a ref to avoid re-renders; rAF loop reads `Date.now() - lastInteractionAt > 4000` before advancing.
- Hover description uses `grid-template-rows: 0fr → 1fr` trick for a clean height transition without measuring.

## Files touched

- `src/components/live-topics-list.tsx` — descriptions, sub-medium popover, idle auto-scroll, slot in marquee under featured card.
- `src/components/room-prompt-marquee.tsx` *(new)* — 2-row marquee of clickable prompts.
- `src/lib/topic-prompts.ts` *(new)* — `TOPIC_DESCRIPTIONS`, `ROOM_PROMPTS` (with `{ title, medium }`).
- `src/routes/workshop.index.tsx` — wire `onUsePrompt` → `HostPrivacyDialog` with `defaultTitle`.
- `src/components/host-privacy-dialog.tsx` — accept optional `defaultTitle` prop (already accepts `defaultMedium`).

## Out of scope

- No changes to `/workshop/$id`, the matchmaker, or the scheduled `/workshops` index.
- No new realtime, no analytics events, no copy changes to the host strip or header.
