## Goal

Make `/instant` reflect what Workshop actually is in v1: one primitive with three flavors. Today the page reads as "drop-in only" — selecting a medium silently teleports you into a room, and Collab-led workshops aren't even mentioned. Audit + streamline (no new features, no new complexity).

## The three flavors (and how the page should signal each)

1. **Drop-in Workshop** — casual, leaderless, any topic. The default "Drop in" CTA.
2. **Medium-specific Workshop** — leaderless but focused (Film, Music, Writing, Build, Visual, Critique, Business of Art, Co-working). Same drop-in matchmaker, scoped to a medium.
3. **Collab-led Workshop** — scheduled, has a host, attached to a Collab. Lives in `workshops` table with `mode='scheduled'` and a `host_user_id` + `topic_collab_post_id`.

(No "anything else" — these three cover the primitive. City-scoped is a filter, not a fourth type.)

## Changes to `src/routes/instant.index.tsx`

### A. Stateful headline + CTA

Track a `selectedMedium: Category | null` state on the page (lifted from the dropdown).

- **Title**: `Workshop` when null → `Workshop: Film` (or chosen label) when a medium is picked. Small "Clear" affordance ("× Any topic") appears next to the title when scoped.
- **Subhead**: swap copy based on state.
  - null → "A seat just opened. Take it."
  - medium → "Drop into a Film workshop. Leaderless, focused."
- **Primary button**: text + action follow state.
  - null → "Drop in" → `joinLounge()`
  - medium → "Drop into Film" → `joinMediumLounge({ medium })`
- The medium dropdown stops auto-navigating on click; it just *selects* the medium and the user confirms with the primary button. (Power move: a small "Drop in now" link inside the dropdown row preserves the current one-click path for users who want it.)

### B. Add the missing third flavor above the fold

Under the CTA, add a single-line "Or" divider and a secondary action:

> **Host a focused session** — Open a Workshop on one of your Collabs → links to `/collab` (or `/collab/new` if user has none).

Replaces the buried sentence in the helper text. Makes Collab-led workshops a visible path, not a footnote.

### C. Helper microcopy

Shorten current paragraph to one line: "Cap 5. Voice or video, your call once you're in." Move the Collab pitch into action (B).

## Changes to `src/components/lounge-fork-dropdown.tsx`

- `onJoinMedium` callback semantics change from "navigate me now" → "select this medium" (parent owns navigation).
- Selected medium gets a checkmark / filled state in the pill list.
- Keep the "Live mediums" section as-is (live counts are great signal).
- Rename section header "Start a medium-specific Workshop" → "Focus on a medium" (less verbose, matches new flow where it's a scope toggle not an immediate launch).

## Changes to `src/components/workshop-strip.tsx`

The directory below the CTA is solid; minor tightening:

- Add a 5th pill **"Collab-led"** that filters `ScheduledList` to workshops with `topic_collab_post_id IS NOT NULL`. (Surfaces flavor #3 in the directory.)
- Pill order: Live now · My upcoming · Collab-led · Upcoming · In {City}
- For each row in `ScheduledList`, add a tiny leading badge:
  - 🎯 if `topic_collab_post_id` (Collab-led)
  - 📍 if `city_id` and not already filtered by city
  - host avatar initial when host is not the current user
  Keeps the list scannable and shows *why* each workshop exists.

## Technical notes

- No DB changes. All filters use existing columns (`mode`, `status`, `topic_collab_post_id`, `city_id`, `host_user_id`).
- `joinMediumLounge` / `joinLounge` server fns unchanged.
- Selected-medium state is local to `/instant` — no URL param needed for v1 (can add `?m=film` later if we want shareable scoped links).
- Keep all existing animations / live-count ticker.

## Out of scope

- New workshop creation flow on this page (collab-led creation stays on the Collab detail page).
- New filters beyond Collab-led.
- Visual redesign — typography, spacing, colors all stay.
