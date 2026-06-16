# Workshop module — 2027 design pass

Scope: `src/components/live-topics-list.tsx` and `src/components/room-prompt-marquee.tsx`, with minor wiring in `src/routes/workshop.index.tsx` and one CSS token in `src/styles.css`. No backend/schema work.

## 1. Kill the "or jump into" row — fold mediums into the CTA

The 5 medium chips push the left column ~80px taller than the topic list and unbalance the split. Replace them with a **split-button**:

```
┌────────────────────────────┬───┐
│  Open the first room   →   │ ▾ │
└────────────────────────────┴───┘
```

- Primary half: existing "Open the first room / Match me to a seat" CTA — unchanged behavior.
- Caret half: opens a `Popover` listing the 5 work mediums (Film, Music, Writing, Build, Visual) plus Critique and Co-working in a secondary group. Each row shows live count (•3) and on click calls `onPick(medium)`. Keyboard: ArrowDown opens, ArrowUp/Down navigate, Enter selects, Esc closes.
- The split-button is the only element under the headline; gives the left column ~120px back so it visually matches the topic list height.

## 2. 2027 pass — what "trending forward" means here

Concrete moves, not vibes:

**a. Tactile hairlines + soft halo, not cards-in-cards.**
The current `rounded-2xl border bg-surface shadow-soft` outer card around an already-bordered grid reads as 2023 dashboardy. Drop the outer border + shadow on the container; use a single hairline divider between the two halves and an ambient soft halo (`box-shadow: 0 0 0 1px ink/5, 0 30px 60px -40px ink/15`) so it floats rather than sits in a box.

**b. Live-ness as light, not text.**
Replace the textual "0 people live" label with a thin **pulse bar** at the top of the topic column (1px high gradient bar that breathes when liveCount>0, dim when 0). The number moves to a tabular-nums chip on the topic column header, smaller.

**c. Topic rows: spring-in count chip, not "+ Start" button.**
Right-aligned "+ Start" pill on every row is noisy. Replace with:
- Default: just label + (live count pill if >0)
- On row hover/focus: a single ghost arrow `→` slides in from right; row itself becomes the button.
- The Critique/Co-working sub-medium caret stays but moves inline next to the label as a faint chevron, not a separate column.

**d. Featured card: shift from "section card" to "moment card".**
- Drop the gradient bg from-muted/40. Replace with a single faint gradient line at the top edge (1.5px, `gradient-motion`) — a "now playing" tape feel.
- "START THE NIGHT / JUMP IN" eyebrow keeps but loses the Sparkles icon (overused). Replace with a tiny 3-dot status indicator that pulses when liveCount>0.
- Headline "Any topic" stays in display serif but drop weight one notch — current size feels billboard-y next to the slim topic rows. Pair with a one-line subhead.
- Move the marquee a little closer (less pb) — it currently visually disconnects from the CTA.

**e. Marquee: vapor edge, not hard mask.**
Increase the mask gradient transparency window from 8% to 14% so chips fade in/out more gradually. Add a tiny "pause" affordance: tiny dot bottom-right that highlights when any row is paused (already paused via hover/focus, this just makes it legible). Optional: slow rows further to 130/145/118/135s — current 110s still feels fast for ambient reading.

**f. Type weight rebalance.**
- Eyebrows currently `text-[11px] uppercase tracking-wider` — keep, but lighten color to `ink-muted/70` so they recede.
- Topic row label down from `text-sm` to `text-[13.5px]` with `font-medium` → cleaner rhythm with the eyebrows.
- Live count tabular chip: `text-[10.5px] tabular-nums text-ink/60` — quiet, not shouty.

**g. Subtle micro-motion.**
- Topic rows: when liveCount transitions 0→N, animate the live dot from border-only to filled with a scale spring (framer-motion `layout`).
- Split-button caret: rotate 180° on open (already a pattern in the file, reuse).
- Marquee chips: gentle `transition-all` on hover (`scale-[1.02]`, no shadow).

**h. Mobile.**
Stack layout already exists; apply the same split-button + hairline treatment so mobile and desktop feel like the same surface. Marquee already renders under stack list — keep that.

## 3. Audit fixes rolled into this pass

- The "By topic / N people live" header row uses `justify-between` — the count jumps when it changes from "1 person" to "2 people". Switch to `tabular-nums` + always-plural "live" (already done in the live indicator at top of route header; mirror it here).
- The Critique sub-medium caret currently has `e.stopPropagation` on click but no keyboard handling — Enter/Space falls through to the row. Add `onKeyDown` stop for Space/Enter so the sub-popover doesn't double-trigger row pick.
- `defaultVisible = 6` in split layout — with 8 categories, the "2 more topics" button shows ~always. Either show all 8 (the list is 7 rows tall, fits without scroll) and drop the expand control, OR raise `defaultVisible` to 8. Recommend showing all 8 and removing the toggle — fewer affordances, more honesty.
- Avatar stack column on topic rows is `hidden sm:flex` — at the current 1050px viewport it shows but participants are usually empty, leaving dead space. Render the avatar column only when `stack.length > 0` (it already conditionally renders, but the parent `flex` keeps the gap allocated). Tighten the row gap when empty.

## 4. Files touched

- `src/components/live-topics-list.tsx` — split-button CTA, remove medium chip row, container shell change, row layout/typography pass, drop expand toggle, sub-medium keyboard fix.
- `src/components/room-prompt-marquee.tsx` — mask widening, optional slower durations, paused-state dot indicator.
- `src/styles.css` — add `--shadow-halo` token used by the new container shell.
- `src/routes/workshop.index.tsx` — no API change; ensure the redundant `liveCount` text in the header still reads naturally now that the list also surfaces it (no edit expected, just verify).

## 5. Out of scope

- No changes to `/workshop/$id`, host strip, `HostPrivacyDialog`, `LiveWorkshopsRail`, `WorkshopStrip`, analytics, schema, or server fns.
- No new dependencies.
- No copy rewrite beyond the eyebrow/subhead micro-tweaks above.

## 6. One clarification

For item §1 — when the user clicks the **caret half** of the split-button and picks a medium, should it:
- **A.** Drop them straight into a matching live room (or open a new one) — same as clicking the topic row, OR
- **B.** Pre-fill the host dialog with that medium and let them name+lock the room (same as marquee prompts)?

I'll default to **A** (dropping straight in matches the "Open the first room" verb and matches what the medium chips did before) unless you say B.
