## Goal

Add a **Category** dropdown in the chip cluster on `/groups` (next to "64 groups" / "All"), so the list can be sliced by creative discipline. Works in any tab but most useful on **All**.

## Categories (taxonomy)

Eight buckets covering all 65 current groups, plus Cities:

- **Music** — rap, beats, pop, electronic, DJ, k-pop dance
- **Film & Video** — narrative, doc, animation, vloggers
- **Writing** — poetry, screenwriting, novels, zines, cli-fi
- **Visual Art** — comics, photo, ceramics, type, tattoo, knit, sketch
- **Games & Tech** — game dev, hackathons, TTRPG
- **Performance** — stand-up, drag, voice, cosplay, open mic
- **Audio** — podcasting
- **Scene & Lifestyle** — aesthetic-driven scenes (Indie Sleaze, Y2K, Cottagecore, Sneakerheads, DIY Punk, etc.)
- **Cities** — auto-assigned for `kind='city'`

## Backend

1. Add a Postgres enum `group_category` with the values above (incl. `city`).
2. Add `category group_category` column on `public.groups` (nullable initially).
3. Backfill all existing 65 groups by name (one-shot UPDATE statements grouping the names into buckets — see assignment list below).
4. Add `category` to the admin Groups editor so new groups must pick one.
5. Index `(category) WHERE deleted_at IS NULL` for filter speed.

### Assignment (backfill)

```text
Music          → SoundCloud Rappers, Bedroom Pop, Lo-fi Beatmakers,
                 Synthwave, DJ / Club, Hyperpop, Dreampop, Latin Trap,
                 Drill, Jazz Revival, Album in a Weekend,
                 One-Take Music Video, Beat Battle, K-pop Dance Cover
Film & Video   → Indie Filmmakers, Documentary, Experimental Animation,
                 48-Hour Film Race, Reel-a-Day, Queer Cinema, Food Vloggers
Writing        → Poets, Screenwriters, NaNoWriMo Sprint,
                 Climate Fiction, Zine Makers
Visual Art     → Comic Artists, Photographers, Ceramicists,
                 Type Designers, Tattoo Artists, Knitwear Designers,
                 Sketch-a-Day
Games & Tech   → Indie Game Devs, Hackathon Crews, Solo Dev Jam,
                 TTRPG GMs, RPG One-Shot Crew, Demo Day Prep
Performance    → Stand-up Comics, Open Mic Night, Drag Performers,
                 Voice Actors, Cosplay
Audio          → Podcasters, Podcast Pilot Week
Scene/Life     → Indie Sleaze, Vaporwave Revival, Cottagecore,
                 Y2K Revival, Afrofuturism, New Weird, DIY Punk,
                 Sneakerheads
Cities         → all kind='city' groups
```

## Frontend (`src/routes/groups.index.tsx`)

- Add `c` (category) to the `searchSchema` with `fallback(z.enum([...]), "all")`.
- In the chip cluster (currently `count` pill + tab pill), insert a `<select>` styled as a pill **between** the count and the tab badge, matching the screenshot's spacing:

  ```text
  [ 64 groups ]  [ Category ▾ ]  [ All ]
  ```

- Wire it to filter `filtered` after the existing tab/query filters: `rows = rows.filter(g => g.category === c)`.
- When `c !== "all"`, show it as an active filter chip with an `×` to clear, mirroring the search-query chip pattern.
- Hide the dropdown on the **Cities** tab (redundant) and **For you** when the user has 0 groups.
- Persist `c` in the URL via `navigate({ search: prev => ({...prev, c}) })` so filtered views are shareable.

## Out of scope

- No change to the discovery clusters / trending / browse-by-kind sections.
- No category-based routing (just URL params).
- No multi-select — single category for v1 simplicity.

## Verification

- Migration approved → backfill counts match expected per bucket.
- Switching the dropdown filters cards instantly; the count pill updates.
- Reload preserves `?c=music`.
