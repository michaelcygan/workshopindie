# Collab Board Optimization

A focused pass on `src/routes/collab.index.tsx` plus a card refresh in `src/components/collab-card.tsx`. No schema or business-logic changes — frontend only.

## 1. Categories — medium-only

Currently uses `CATEGORIES` (all 8). Switch to `WORK_CATEGORIES` so the chips become: All, Film, Music, Writing, Build, Visual. This drops Critique, Business of Art, and Co-working — none of which describe a *thing being made*, so they don't belong on a project-collaboration board.

(Note: `collab_posts.category` in the DB can still hold those legacy values; we simply stop offering them as filters. Existing posts in those categories fall outside the chip filters but still appear under "All". No migration required.)

## 2. One-line infinite-scroll category bar

Reuse the exact pattern from the homepage `GalleryControls`: pill bar with single horizontal row, auto-scroll loop on mobile, drag-to-pan, click chip to filter. On desktop, render as a normal pill row (no scroll).

I'll extract the scroller into a small reusable component `src/components/category-scroller.tsx` so the homepage and Collab Board share one implementation (refactor + reuse, not copy-paste). Homepage gets updated to consume it — zero visual change there.

## 3. Location filter — radically simplified

Replace the current absence of a location filter (and the redundant "Newest / Most roles" sort row) with **one row, two controls**:

```text
[ 🔍  City — type to search… (Anywhere)        ] [ ☑ Online only ]
```

- **City search**: a single combobox input. Type → debounced query against `cities(name)` → dropdown of matches → pick one to filter. Empty = anywhere. A small `×` clears it.
- **Online only**: a single checkbox-chip. When on, results are filtered to `location_mode = 'online'` and the city input is disabled/greyed (it's irrelevant).
- When a city is selected and Online-only is off, we include posts that are `in_person` or `hybrid` in that city **plus** all `online` posts (online posts are location-agnostic and always relevant). This is the "GOAT" behavior — you never miss an online collab just because you set a city.

Sort: drop the visible sort toggle. Default to a smart blended order — newest first, but posts with more open roles bubble slightly. (Implemented as `ORDER BY created_at DESC` after a light client-side score; no UI needed. If you'd rather keep an explicit sort toggle, say the word.)

All filter state goes into URL search params via `validateSearch` + `Route.useSearch()` so links are shareable and back/forward works.

## 4. Card redesign — modern, scannable

The current card crams chips, status, title, description, four meta icons, and a "posted by" line into one rectangle. New layout, mobile-first:

```text
┌─────────────────────────────────────────┐
│  [Film]                      2d ago  ⋯  │
│                                          │
│  Looking for a vocalist for a            │
│  moody synthwave EP                      │
│                                          │
│  Two-track EP, mostly tracked. Need a    │
│  voice that sits between Phoebe and…     │
│                                          │
│  ◐ Vocalist   ◐ Mixing engineer  +1     │
│                                          │
│  ─────────────────────────────────────   │
│  👤 Maya R.    · Online · Paid           │
└─────────────────────────────────────────┘
```

Key changes:
- **Open role chips** are the visual anchor (was buried as a number). Pulled from `collab_roles` — first 2 by name, then `+N` overflow.
- **One meta line** at the bottom: avatar + display name · location summary · comp. Drops the four-icon row.
- **Relative time** ("2d ago") replaces redundant "open" status chip — status is implicit (only open posts are listed).
- **Hover**: subtle lift + the title gets `text-gradient-motion` to match the new button/accent treatment.
- **Layout**: 1 col mobile, 2 col `md`, 3 col `xl` (was 1/2/3 starting at `sm`, which felt cramped). More breathing room.

Card stays a single `<Link>` to `/collab/$slug`.

## 5. Empty state

Refresh copy to match the new flow:

- Old: "No open calls yet." / "Be the first. Post your idea, list the roles you need, see who shows up."
- New: "Nothing open right now." / "Be the first to post — list the roles, the people show up."

## Technical details

**Files:**
- `src/routes/collab.index.tsx` — rewrite filter row, swap to `WORK_CATEGORIES`, add `validateSearch`, update query to join city + filter by `location_mode`/`city_id`, drop sort toggle, update empty state.
- `src/components/collab-card.tsx` — redesign, add `roles: { role_name }[]` and `created_at` to the data shape (already partially fetched), render relative time.
- `src/components/category-scroller.tsx` — new shared component extracted from `index.tsx`.
- `src/routes/index.tsx` — replace inline mobile scroller with `<CategoryScroller>`, no visual change.

**Query change:** Add `roles:collab_roles(role_name,sort_order)` to the existing select so we can render up to 2 role chips per card without a second round-trip.

**Filter SQL pattern:**
```text
status = 'open'
AND (online_only ? location_mode = 'online' : true)
AND (city_id set ? (city_id = $1 OR location_mode = 'online') : true)
AND (category != 'all' ? category = $cat : true)
```

**Search params (zod):**
```text
{ cat: WorkCategory | "all"   (default "all"),
  city: string | undefined,     (city id)
  online: boolean               (default false) }
```

## Out of scope
- No changes to `/collab/new`, `/collab/$slug`, or any RLS / DB schema.
- No changes to the way posts are created, applied to, or notified.
- The legacy category values (`critique`, `business`, `coworking`) remain valid in the DB; they're just hidden from the filter UI.

## Open question
Drop the "Newest / Most roles" sort toggle entirely, or keep it as a small text dropdown next to the filter row? My recommendation is drop — fewer controls, smarter default — but happy to keep it if you want explicit user control.
