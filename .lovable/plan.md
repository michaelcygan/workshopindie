## Goal

Make `/workshop` fit above the fold on a standard laptop (≈1050×728) with the Live Now module fully visible, while feeling like a 2027-grade, intuitive entry point. Host controls drop below the fold; the live decision surface owns the first screen.

## What's eating space today

1. `←Home` link sits on its own row — pure padding.
2. `py-16` top padding + `mt-6` + `mt-3` + `mt-5` between header chunks burns ~120px before any content.
3. `font-display text-5xl Workshop` plus a 2-line paragraph plus a device-status row = 3 stacked blocks doing one job (orient + reassure).
4. "0 live" counter is louder than the live list it's counting.
5. Device status ("Mic ready / Camera ready") takes a full row and is rarely actionable — only matters when blocked.
6. The Live Now card has generous internal padding (`px-5 py-3.5` per row × 5 rows + header + footer) ≈ 360px. Combined with everything above, the "Host controls" card pushes off-screen and the page scrolls.

## Redesign — one cohesive cockpit

```text
┌────────────────────────────────────────────────────────────────────┐
│ ← Home  ·  Workshop                              ● 3 live  🎤 🎥   │  ← single compact bar
├────────────────────────────────────────────────────────────────────┤
│  Drop into a live room, or open the first one. 5 seats per room.  │  ← one-line subtitle
├──────────────────────────────┬─────────────────────────────────────┤
│  ✨ Any topic     2 live     │  ● Writing     —   open first room │
│     matchmaker picks a seat  │  ● Painting    —   open first room │
│  ──────────────────────────  │  ● Photo       —   open first room │
│  ● Music         1 live      │  ● Film        —   open first room │
│  ● Design        live now    │  + 4 more topics ▾                 │
└──────────────────────────────┴─────────────────────────────────────┘
            (above the fold ends here on 1050×728)
┌────────────────────────────────────────────────────────────────────┐
│ Want host controls?  Name it, pick visibility.  [ Spin up room → ] │
└────────────────────────────────────────────────────────────────────┘
+ LiveWorkshopsRail + WorkshopStrip below
```

### Key moves

1. **Collapse the header into one bar.** `← Home · Workshop` left, `● N live` + mic/cam status dots right. Remove the giant `text-5xl` title — keep "Workshop" as a normal-weight wordmark in the bar (the page is already at `/workshop` and the nav highlights it). One-line subtitle below.
2. **Tighten outer padding.** `py-10 md:py-16` → `py-6 md:py-8`. Drop the `mt-6 / mt-3 / mt-5` stack; use `space-y-3`.
3. **Device status → 2 small dots** next to the live counter (green = ready, muted = absent). Inline error toast only if both are missing AND user taps a row.
4. **Two-column Live Now grid on `md+`.** "Any topic" gets a wider, featured left column (it's the default action, always-on). Right column lists topics as a denser stack: row height `py-2` (was `py-3.5`), 12px row text, inline action chip on hover only — title row stays clickable.
5. **Smarter empty state.** When zero topics are live, "Any topic" becomes "Open the first room" so the page never reads as dead. Inline copy switches to "Be the first in tonight."
6. **Show 5 topics by default** in the right column (denser rows fit easily), collapse the rest behind "+ N more topics ▾". Live topics always promoted above empty ones.
7. **Host controls below the fold, but irresistible.** Single inline strip: label + one-line value prop + filled ink button (was outlined). It's the next thing your eye lands on after scrolling 1cm.
8. **Motion polish.** Live dot uses the existing gradient-motion ping. Row hover: subtle 200ms ink-shift + chevron reveal. New-live-room arrival animates the row in from the bottom with a 12px slide (FLIP-style via `AnimatePresence`, which we already use). Counter morphs with the existing `popLayout`.
9. **2027 cues without gimmicks.** Tabular numerics everywhere; hairline dividers (`border-border/60`); soft, single-elevation surface; remove the dashed border on the Host strip (replace with a single hairline + ink CTA); align all radii to `rounded-2xl` for visual rhythm.
10. **Accessibility/keyboard.** Each row is a `<button>` already — add visible focus ring (`focus-visible:ring-2 ring-ink/20`) and arrow-key navigation between rows in the Live list.

### Above-the-fold budget (1050×728)

| Block                          | Approx height |
|--------------------------------|--------------:|
| Top nav (existing)             | 56            |
| Compact header bar + subtitle  | 72            |
| Live Now grid (2 cols, 5 rows) | 360           |
| Breathing room                 | 40            |
| **Total**                      | **~528**      |

Leaves ~200px for the host strip to peek above the fold as a teaser, encouraging scroll without competing with the live decision.

## Files to change

- `src/routes/workshop.index.tsx`
  - Replace the stacked header block with a single `header` row (Home link + wordmark + live counter + device dot chip).
  - Tighten outer padding; remove `mt-6 / mt-3 / mt-5`.
  - Wrap `LiveTopicsList` in a 2-col grid on `md+` (passes a `featured` slot + `topics` slot via new props OR we restructure the component — see below).
  - Convert Host strip from dashed outline + outlined button to hairline strip + filled `Button` (default variant).
- `src/components/live-topics-list.tsx`
  - Add a `layout?: "stack" | "split"` prop. In `split`, render "Any topic" as a left card (full height of the right column) and the topic rows in a right column.
  - Reduce row vertical padding `py-3.5` → `py-2.5`; row text `text-sm` → `text-[13px]`; tighten header `pt-4 pb-2` → `pt-3 pb-1.5`.
  - Default visible count 4 → 5 (denser rows accommodate it).
  - Add focus-visible ring and keyboard arrow navigation between rows.
  - When `liveCount === 0`, swap "Any topic" CTA copy to "Open the first room" and sublabel to "Be the first in tonight."

## Out of scope

- No backend changes; same server fns, same query cadence.
- No changes to `/workshop/$id`, `LiveWorkshopsRail`, or `WorkshopStrip` (they stay below the fold as-is).
- No taxonomy or matchmaker changes.
- No new icons/illustration system; keep current iconography.
