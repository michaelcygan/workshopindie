# Workshop join module — prompt pass, 4 rows, and connection audit

Scope: `src/lib/topic-prompts.ts`, `src/components/room-prompt-marquee.tsx`, plus a light audit pass surfacing wiring gaps. No backend/schema changes.

## 1. Rebalance the prompt pool (65/35 obvious vs. weird)

Today the list leans esoteric ("Type-design crit", "Cold-open writers' room", "Morning pages then heads-down"). Rewrite `ROOM_PROMPTS` in `src/lib/topic-prompts.ts` so roughly **65% are immediately obvious** ("Mix feedback, bring stems", "Co-writing sprint", "Photo critique") and **35% stay weird/specific** ("1 hyperpop song an hour, all day", "Mental health hackathon", "Need a vocalist for a tech house song"). Target ~60 prompts total so 4 desktop rows of ~14 each draw from distinct windows without obvious repeats.

Each medium gets 6–8 entries with that same internal ratio. The weird ones stay first-person and time-bound — they're what sells the platform.

I'll tag each prompt with a small `weight: "obvious" | "wild"` field so the marquee can deal them out evenly across rows (no row ends up all-wild or all-obvious).

## 2. Four rows on desktop, half-speed again

In `src/components/room-prompt-marquee.tsx`:

- Add a 4th row. Direction pattern: **R → L → R → L** (rows 1+3 use `animate-marquee-x`, rows 2+4 use `animate-marquee-x-reverse`).
- Halve the speed once more: durations become **~110s / 125s / 100s / 118s** (was 58/64/52). Per-row jitter prevents lockstep.
- **Responsive row count**: mobile (<640px) keeps 2 rows, tablet 3, desktop (md+) 4. Implemented by rendering all 4 rows and hiding rows 3+4 with `hidden md:block` / `hidden sm:block` — no JS resize listener needed.
- Bump `perRow` to 14, slice the shuffled pool into 4 non-overlapping windows. If pool is short, re-shuffle and slice again (existing fallback).
- Interleave by `weight` per row so each row has the same obvious/wild ratio.
- Respect `prefers-reduced-motion` (already handled in `styles.css`).

## 3. Module audit — connection gaps & flow opportunities

Issues I found in `live-topics-list.tsx`, `room-prompt-marquee.tsx`, and `workshop.index.tsx` that are worth fixing in this same pass:

**a. Prompt chip → host dialog loses the live-room context.**
A prompt click always opens `HostPrivacyDialog`, even when a matching live room already exists for that medium. Better flow: if `liveByMedium.get(prompt.medium) > 0`, the popover shows a third option — **"Join a live one"** — that calls `onPick(prompt.medium)` instead of hosting. Three buttons: *Join live (N) · Start now · Cancel*. Keeps "start now" but rewards the user when the room already exists.

**b. Sub-medium picker only on Critique / Co-working.**
The `SUB_PARENTS` set is hard-coded. The "Any topic" featured card has no analogous picker even though it's the most-clicked surface. Add a tiny "or pick a medium" inline row under the Any-topic CTA (5 medium chips) so users who know what they want don't have to scan the topic list.

**c. Prompt marquee has no keyboard discoverability.**
Chips are `<button>` so they're tab-reachable, but with 56 chips moving at 100s+, keyboard users will struggle. Add a "Pause" affordance: hovering OR focusing any chip pauses its row (CSS-only via `:has(:hover, :focus-within)` on the row container — already half-there with pause-on-hover, just extend to focus).

**d. `featuredFooter` (the marquee) lives inside the Any-topic card.**
On mobile (`stack` layout) the marquee never renders — `featuredFooter` is only consumed in the `split` branch. Mobile users see no prompts at all. Either render it under the stacked list on mobile, or skip it on mobile intentionally — recommend rendering 2 rows below the stacked list.

**e. No "what just happened" feedback.**
When a host opens a room from a prompt, the prompt vanishes (next shuffle). Optional: keep last-used prompt visually pinned for ~10s with a "you opened this" subtle ring, so the host's intent is reinforced. Low priority — flagging only.

**f. `hostLabel` computation in `workshop.index.tsx`.**
`hostLabel` reads `hostMedium` but the CTA still says "Spin up your room" even after a prompt pre-fills a medium, because `hostMedium` is set but `pendingTitle` isn't surfaced on the strip button itself. Minor: when a prompt is queued (state added in next step), the host strip button could read "Spin up: *{title}*" so the user sees the dialog isn't a surprise. Defer if you want to keep this PR tight.

**g. Pool re-shuffle on every re-render.**
`useMemo` keys on `perRow` only, but `Math.random()` inside `shuffle()` means HMR/dev re-mounts pick new prompts. Production is fine (no re-mount), but worth seeding once per session via `useRef` so users see a stable set across navigation back to `/workshop`.

## 4. What I'll ship this turn

- Rewrite `ROOM_PROMPTS` with the 65/35 mix + `weight` tags (~60 entries).
- Marquee: 4 rows responsive, half-speed durations, weight-balanced slicing, stable per-session shuffle, focus-within pause.
- Prompt popover: third "Join a live one" button when that medium has live rooms.
- Any-topic featured card: inline 5-chip medium quick-picker under the CTA.
- Render the marquee under the stacked list on mobile too.

## 5. Out of scope (flagging only)

- Host strip CTA dynamic label (item f).
- "You opened this" pinned-prompt feedback (item e).
- Any changes to `/workshop/$id`, `HostPrivacyDialog` internals, analytics, schema, or server fns.

## Files touched

- `src/lib/topic-prompts.ts` — rewritten prompts + `weight` field.
- `src/components/room-prompt-marquee.tsx` — 4 rows, responsive, slower, weight-balanced, stable shuffle, "Join live" popover variant.
- `src/components/live-topics-list.tsx` — Any-topic inline medium picker; mobile marquee slot.
- `src/routes/workshop.index.tsx` — pass `liveByMedium` (or equivalent) down so the popover knows when to show "Join live"; wire mobile footer.

## One clarification

For item (c) — when a prompt's medium has live rooms, do you want:
- **A.** Three buttons (Join live · Start now · Cancel) — gives the user the choice each time, or
- **B.** Auto-prefer Join live (Start now becomes secondary/ghost) — nudges toward joining what's already happening?

I'll default to **A** unless you say otherwise.
