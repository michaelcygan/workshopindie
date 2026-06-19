
# Empty-state as a launchpad: Purpose pills + Live Now jump

Reuse the dead space in the Quiet empty state (`channel-view.tsx`, lines ~730–778) as a 2027-feel "set a direction" surface. Three additions, one permission tweak, no DB schema change.

---

## Part 1 — Purpose pills (one-click rename)

### Behavior
When the room has its default/generic name (matches `formatRoomTitle` fallback like "Workshop" or `Workshop: <category>`), surface 4 large, motion-animated pills that each ARE the suggested name. Click → renames the live room (and the paired workshop if any).

Layout: a 2×2 grid of soft "purpose tiles" — large enough to read as a statement, not chips. Each pill shows the full proposed title as bold display text + a one-line hint underneath.

```
┌────────────────────────────┐  ┌────────────────────────────┐
│ Songwriting jam            │  │ Critique my draft          │
│ trade hooks · 60 min       │  │ share a WIP · get notes    │
└────────────────────────────┘  └────────────────────────────┘
┌────────────────────────────┐  ┌────────────────────────────┐
│ Co-working                 │  │ Pitch & polish             │
│ heads down · soft chat     │  │ workshop a pitch deck      │
└────────────────────────────┘  └────────────────────────────┘
```

### Suggestion source
Derive 4 from `room.medium` / `room.category` via a small map in `src/lib/topic-prompts.ts` (file exists — extend it). Each entry: `{ title, hint }`. Generic fallback set when no category. Shuffle deterministically by `roomId` so it's stable per room, not jittery on re-render.

### Rename action
Reuse `setRoomTitle` (host RPC) AND extend permission: in `host-room.functions.ts → setRoomTitle`, allow the rename when `host_user_id IS NULL AND status='active'` (matches the leaderless-edit rule already used for the room note). Hosted rooms unchanged — only the host can rename.

When the live room is workshop-paired (`workshop_id` not null), also update `workshops.title` in the same handler, but only if the caller is the workshop host (skip otherwise — live room rename alone is fine).

On success: optimistic title swap, invalidate `["instant-room", id]`, the pills collapse into a small "Renamed to …" toast with an Undo (5s, calls `setRoomTitle` with prior title).

### Visibility rules
Show purpose pills only when ALL hold:
- `messages.length === 0` (already the empty-state branch).
- Current title is the generic fallback (no purposeful rename yet) — detected by comparing against `formatRoomTitle(null, room.medium)` output.
- Viewer is host OR room is leaderless.

Hide once renamed or once first message lands.

---

## Part 2 — "Live Now" jump

Add a fourth row under the purpose pills: a quiet pill row containing one CTA — `↻ Browse Live Workshops` — that navigates to `/workshop` (the index with `LiveWorkshopsRail`). Uses `<Link>` from `@tanstack/react-router`. On hover: subtle arrow translate. No `media.leave()` call here — `/workshop` index is the lobby; leaving is implicit when they Drop in elsewhere. We DO call `media.leave()` before navigating so they're not ghost-present in the abandoned room.

Sits below the purpose grid as a subtle "or explore what else is live →" affordance — not competing with the rename CTA.

---

## Part 3 — 2027 motion polish

Replace the current radial-gradient + static chips with:
- **Aurora bloom**: a slow-pulsing conic-gradient halo behind the title (`motion.div` with `animate={{ rotate: 360 }}` 40s linear, opacity 0.15).
- **Pill stagger**: each purpose pill enters with `framer-motion` `whileInView` opacity/y stagger (40ms gap), `whileHover` lift `y:-2` + ring glow via `ring-1 ring-primary/30`.
- **Magnetic press**: `whileTap={{ scale: 0.98 }}`.
- **Type treatment**: pill title uses `font-display` at `text-base/tight`, hint at `text-[11px] text-ink-muted`. Pill bg: `bg-surface/60 backdrop-blur-sm` + dashed `border-border/60`, hover → solid `border-primary/40 bg-primary/[0.04]`.
- Existing starter chips ("Say hi", "Drop a link", "What's everyone working on?") demote to a smaller row beneath the purpose grid — keep them, just lighter weight. Claim Host chip stays prominent (already is).

---

## Files

- `src/components/channel-view.tsx` — rewrite the empty-state block (lines ~729–778): aurora bloom, purpose-pill grid, Live Now jump, demoted starter chips. New small subcomponent `PurposePills` co-located in the same file (or extracted to `src/components/purpose-pills.tsx` if it grows past ~80 lines).
- `src/lib/topic-prompts.ts` — extend with `WORKSHOP_PURPOSES: Record<category, Array<{title, hint}>>` + `getPurposeSuggestions(roomId, category)` (deterministic shuffle, returns 4).
- `src/lib/host-room.functions.ts` — relax `setRoomTitle`: allow when room is leaderless; when workshop-paired, only update `workshops.title` if caller is workshop host.
- No migration. No new component if kept inline.

## Out of scope

- Free-form rename input (already exists via the existing host menu / collab sheet).
- AI-generated topic suggestions (static map is enough for now; can swap later).
- Persisting "dismissed pills" — they auto-hide on first message or rename.
- Changes to the Live Now page itself.
