## Goal
Turn `/groups` from a sparse 10-city wall into a dense, browsable directory that sparks workshop & collab creation right from the Group itself.

---

## 1) Seed a real catalog (migration)

Currently only 10 City groups exist — every other tab is empty, which is why the page feels thin. Seed ~40 groups across all four kinds, each with `tagline`, `description`, `accent_color`, and a curated unsplash `cover_url` so the cards stop looking like identical orange blocks.

**Genres** — Indie Filmmakers, SoundCloud Rappers, Bedroom Pop, Lo-fi Beatmakers, Indie Game Devs, Comic Artists, Zine Makers, Stand-up Comics, Documentary, Experimental Animation, Synthwave, DJ / Club, Photographers, Poets, Screenwriters.

**Scenes** — Indie Sleaze, Hyperpop, DIY Punk, Vaporwave Revival, Cottagecore, Y2K Revival, Afrofuturism, New Weird, Dreampop.

**Micro** — Hackathon Crews, 48-Hour Film Race, NaNoWriMo Sprint, One-Take Music Video, Album-in-a-Weekend, Solo Dev Jam, Beat Battle, Open Mic Night, Sketch-a-Day, Demo Day Prep.

**Cities** — keep existing 10, mark NYC / LA / Tokyo as `featured_at = now()` so the Featured rail isn't empty.

All seeded via `supabase--insert` (idempotent `ON CONFLICT (slug) DO UPDATE`).

---

## 2) Redesign `/groups` for density + discovery

Replace the current 3-up card grid with a magazine-style layout that uses the horizontal space and pivots based on the active tab:

```text
┌──────────────────────────────────────────────────────────┐
│  ← Groups                              [Search ⌕]        │
│  ● Your scenes · Join the rooms…       42 groups open    │
├──────────────────────────────────────────────────────────┤
│  Featured events carousel  (kept, tightened)             │
├──────────────────────────────────────────────────────────┤
│  [For you] [All] [Cities] [Genres] [Micro] [Scenes]      │
├──────────────────────────────────────────────────────────┤
│  TRENDING NOW                                            │
│  ▸ horizontal rail of 8 compact GroupChipCards           │
├──────────────────────────────────────────────────────────┤
│  BROWSE BY KIND   (only on All / For you)                │
│  ┌─ Cities ──────┐ ┌─ Genres ──────┐                     │
│  │ NYC · LA · …  │ │ Indie Film …  │                     │
│  └───────────────┘ └───────────────┘                     │
│  ┌─ Scenes ──────┐ ┌─ Micro ───────┐                     │
│  └───────────────┘ └───────────────┘                     │
├──────────────────────────────────────────────────────────┤
│  ALL GROUPS — grid (2/3/4 cols responsive)               │
└──────────────────────────────────────────────────────────┘
```

Key UI moves:
- **Compact card variant** (`GroupCardCompact`) — smaller cover band, accent-color tint instead of identical orange, member/workshop count as DottedRow-style meta. Used in rails and "Browse by kind" preview clusters.
- **4-up grid on xl** (currently caps at 3) so a 1280px screen shows more above the fold.
- **Tab-aware section order**: when a `kind` tab is active, hide "Browse by kind" and lead straight into the full grid sorted by member_count, with a sub-filter chip row ("Trending · New · Most active this week").
- **"Trending now" rail** — top 8 by recent member joins; gives the page motion even with sparse data.
- **Empty cover fallback** — generate a subtle gradient from `accent_color` so cards look distinct without imagery; show kind icon watermark.

---

## 3) Make Groups a creation engine

Currently `/g/$slug` is mostly a read surface. Add explicit "spark" CTAs that turn a Group into the entry point for Workshops and Collabs:

**On the Group hero (`/g/$slug`)** — add a sticky action bar under the title:
- `Start a Workshop here` → routes to `/workshops/new?group=<id>` (pre-tags the new workshop to this group via existing `tagWorkshopInGroup`).
- `Post a Collab here` → routes to `/collab/new?group=<id>` (pre-tags via `tagCollabInGroup`).
- `Share your Work` → opens existing pinned-works picker scoped to this group.

**New "Spark" tab on the Group page** — a single panel showing:
- Open Collabs looking for collaborators in this group (existing `group_collabs` join).
- Workshops scheduled in next 7 days.
- Prompt cards: "3 people are looking for a drummer", "2 hackathon crews forming for next weekend" — pulled from recent `collab_posts` + `workshop_lobbies` filtered by this group. Each is a one-click join.

**On `/groups` index** — every GroupCard gets a tiny `+ Workshop` / `+ Collab` quick-action on hover (desktop) or in an overflow menu (mobile), so creation is one tap from the directory, not three pages deep.

**Cross-group discovery** — at the bottom of each Group page, add a "Adjacent scenes" rail (other groups members of this group also joined) to keep the flow moving.

---

## 4) Routing / pre-fill plumbing

- `/workshops/new` and `/collab/new` learn a `?group=<id>` search param. On submit, after the row is created, call the existing `tagWorkshopInGroup` / `tagCollabInGroup` server fns so the link is permanent.
- Add a tiny `GroupPrefillBanner` at the top of those forms: "Posting into **Indie Filmmakers** · change".

---

## Technical Notes

- **Files added**: `src/components/group-card-compact.tsx`, `src/components/groups-trending-rail.tsx`, `src/components/groups-browse-by-kind.tsx`, `src/components/group-spark-bar.tsx`, `src/components/group-spark-panel.tsx`, `src/components/group-prefill-banner.tsx`, `src/components/adjacent-groups-rail.tsx`.
- **Files edited**: `src/routes/groups.index.tsx` (layout overhaul), `src/routes/g.$slug.tsx` (spark bar + tab + adjacent rail), `src/routes/workshops.new.tsx`, `src/routes/collab.new.tsx` (group prefill), `src/components/group-card.tsx` (accent-color gradient fallback, hover quick-actions).
- **DB**: one migration / insert to seed ~40 groups. No schema changes — uses existing `groups`, `group_workshops`, `group_collabs` tables.
- **No new server functions** — reuses `tagWorkshopInGroup`, `tagCollabInGroup`, `listUpcomingForMyGroups`.
- Adjacent-groups query: SQL aggregating `group_members` overlap; cached 5 min.

---

## Open question (one)

For the Group cover imagery, two options:
- **(A)** Use curated Unsplash URLs per seeded group (free, instant, realistic photos).
- **(B)** Skip photos, lean on per-group `accent_color` gradient + kind glyph for a more uniform editorial look.

I lean **B** — it matches the serif/hairline dialect we built in Pass 1/2 and won't fight your brand. Tell me if you'd rather have photos.
