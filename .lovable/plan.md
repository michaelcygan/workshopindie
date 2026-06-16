## Room prompt marquee — slower, 3 rows, "start now" confirm

Scope: `src/components/room-prompt-marquee.tsx`, `src/styles.css`, and a small wiring tweak in `src/routes/workshop.index.tsx`. No backend, no schema, no other components.

### 1. Slow the scroll by half
- Current loop is ~25s. Double the duration to ~50s on both rows (and the new third row). Keep `linear infinite`, keep pause-on-hover, keep the edge mask.
- Respect `prefers-reduced-motion` (already frozen via existing rule).

### 2. Add a third row, alternating directions
- Render three stacked marquee rows inside `RoomPromptMarquee`:
  - Row 1 → right-to-left (`animate-marquee-x`)
  - Row 2 → left-to-right (`animate-marquee-x-reverse`)
  - Row 3 → right-to-left (`animate-marquee-x`)
- Bump `perRow` default from 12 → 10 so each row is dense but distinct; shuffle the pool once and slice into three non-overlapping windows (fall back to re-slicing if the pool is short).
- Slight per-row duration jitter (e.g. 48s / 52s / 50s) so the rows don't visually lockstep.

### 3. "Start now" confirm step on chip click
- Today a chip click immediately opens `HostPrivacyDialog` (privacy + title). The user wants a lighter intermediate confirmation that feels like "open this exact room".
- Add a tiny `PromptConfirmPopover` anchored to the clicked chip (shadcn `Popover`):
  - Header: the prompt title (e.g. *"1 hyperpop song an hour, all day"*)
  - Subline: matched topic label (e.g. *Music · public room*)
  - Primary button: **Start now** → calls existing `onUsePrompt(prompt)` which opens `HostPrivacyDialog` pre-filled (unchanged downstream).
  - Secondary: **Cancel** (closes popover).
- This keeps the privacy choice in the existing dialog but gives the marquee chip a clear "this is what will open" beat, matching the user's "opening to that name's workshop that can be clicked Start now" flow.
- Keyboard: Enter/Space on the chip opens the popover; Esc closes; focus returns to the chip.

### 4. Code quality
- Keep `RoomPromptMarquee` self-contained; extract `MarqueeRow` to accept `direction` and `durationMs` props so the three rows share one implementation.
- No new deps. No changes to `topic-prompts.ts` data. No copy changes elsewhere on the page.

### Files touched
- `src/components/room-prompt-marquee.tsx` — third row, slower durations, per-chip confirm popover.
- `src/styles.css` — adjust marquee keyframe durations (or expose via CSS var so component sets per-row duration inline).
- `src/routes/workshop.index.tsx` — no logic change; verify `onUsePrompt` still receives the prompt unchanged.

### Out of scope
- No changes to topic list, featured matchmaker card, host strip, or `/workshop/$id`.
- No new analytics, no schema/backend work.

### One clarification before I build
The "Start now" button in the popover currently routes through `HostPrivacyDialog` (so the host still picks Open / Mutuals / Invite). Do you want:
- **A.** Keep the privacy dialog after Start now (one extra click, but host keeps control), or
- **B.** Skip the dialog entirely — Start now immediately opens a public room with that title and drops the host in?

I'll default to **A** unless you say otherwise.
