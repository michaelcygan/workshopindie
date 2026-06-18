## Goal
No new surfaces. Tighten what's there — denser cards, faster filtering, better space utilization, more groups, and one-tap creation.

---

## 1) +20 more groups (depth)

The current 45 cover the obvious lanes. Add a second wave so search almost always returns something and "For you" stays interesting after a few joins. All seeded idempotently like last round.

- **Genres**: Podcasters, Ceramicists, Type Designers, Tattoo Artists, Knitwear Designers, Drag Performers, Food Vloggers, Voice Actors, TTRPG GMs, K-pop Dance Cover.
- **Scenes**: Queer Cinema, Climate Fiction, Latin Trap, Drill, Jazz Revival, Cosplay, Sneakerheads.
- **Micro**: Reel-a-Day, RPG One-Shot Crew, Podcast Pilot Week.

---

## 2) `/groups` polish

**Persist tab + search in the URL** (`?t=genre&q=sleaze`) so people can share filtered links and back-button works. Uses TanStack `validateSearch`.

**Sticky filter bar.** After scrolling past the hero, the tab row + search collapse into a single sticky strip at the top of the viewport so you can change scope without scrolling back up. Hairline border, surface background, blur.

**Tighter rhythm.** Drop the duplicated bottom "Featured" rail (Featured groups already surface via the gradient cards being sorted-first; the Featured events carousel stays). Reduce vertical gaps from 10/12 to 8 between sections so the page reads as one continuous browse instead of four stacked pages.

**Trending rail visual upgrade.** Right now it's a row of identical pill cards. Restyle as a numbered editorial list (01, 02, 03…) with the kind glyph + accent stripe so it feels like a chart, not another grid.

**Browse-by-kind density.** Each panel shows 4 samples and a "See all → kind tab" link. Bump to 6 samples on `xl` (two columns inside the panel) since there's room.

---

## 3) `GroupCard` level-up

- **Member avatar stack** (3 overlapping circles) above the count row — instant social proof. Fetched via a single batched `group_members` query keyed by visible group ids; cached.
- **Hover quick-actions** (desktop) and bottom overflow (mobile): `+ Workshop` / `+ Collab` route to `/workshops/new?group=<slug>` and `/collab/new?group=<slug>`. Same plumbing we already shipped.
- **Accent treatment**: replace flat gradient with a soft top-light sheen + 1px inner ring tinted by accent — keeps the dialect, looks less synthetic.
- **Joined affordance**: tiny `In` pill on the cover replaces the corner badge so it doesn't fight with the kind chip.

---

## 4) `/g/$slug` polish

- **Promote the "Post here" dropdown to a visible 3-button Spark Bar** under the title on `md+`: `Start a Workshop`, `Post a Collab`, `Share Work`. On mobile, keep the dropdown to save space.
- **Sticky sub-nav.** Tab row becomes sticky once it leaves the viewport — same pattern as `/groups`.
- **Tab order.** Default to `events` (or fall back to whichever tab has content) instead of `work`, so the first thing visitors see is "what's happening here" not "what's been posted".
- **Hairline divider + count chip** on the Adjacent Scenes rail to match the rest of the dialect.

---

## 5) Mobile pass (1 round)

- Tab pills wrap onto one row with horizontal scroll instead of two stacked rows.
- Browse-by-kind goes 1-up under `sm`, panels lose their inner gap to feel like accordions.
- Group cards: cover band trimmed from h-24 to h-20 so two cards fit above the fold on a 375px screen.
- Sticky filter strip respects the bottom mobile nav (z-index + safe-area).

---

## Technical Notes

- **Files added**: `src/components/groups-trending-list.tsx` (replaces rail), `src/components/group-card-actions.tsx` (hover/menu quick-actions), `src/components/group-spark-bar.tsx`, `src/hooks/use-group-member-avatars.ts`.
- **Files edited**: `src/routes/groups.index.tsx` (URL search, sticky bar, layout), `src/routes/g.$slug.tsx` (spark bar, sticky tabs, default tab), `src/components/group-card.tsx` (avatars, sheen, hover actions), `src/components/groups-browse-by-kind.tsx` (6 samples on xl).
- **DB**: one `supabase--insert` to seed the 20 new groups, idempotent on slug.
- **No new server functions, no schema changes.**

---

## Out of scope (for this pass)

- Group creation flow (users-create-their-own). Worth a dedicated pass later.
- Per-group cover photography — sticking with accent gradients keeps the editorial dialect.
- Notifications when a Group you're in sparks a new Workshop / Collab — that's a real feature, not polish; flag for after launch.
