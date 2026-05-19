## Post a Collab — scale pass

Today's `collab.new` ships two scrappy v1 fields:
- **City:** a `<select>` populated from the first 200 rows of `cities` — most of the world is invisible, and "Anywhere" is the only escape hatch.
- **Timeline:** a freeform `text` input — great for vibe, useless for filtering, sorting, or expiry.

The good news: the app already uses **OpenStreetMap via Photon** (`photon.komoot.io`) in `VenueSearch` — keyless, no API key needed, same provider we'll standardize on. And `resolveVenueAndCity` already knows how to find-or-create a city from an OSM result with a deterministic slug.

Here's the pass.

---

### 1. Location: OSM-backed, multi-city, remote-friendly

**Replace the City `<select>` with a Photon CityCombobox** — same component pattern as `collab.index.tsx`, but typeahead-backed by Photon (`osm_tag=place:city,place:town`) instead of the local `cities` table. Selecting a city calls a new `resolveCityFromOSM` server fn (a slimmer sibling of `resolveVenueAndCity`) that find-or-creates the row using the existing `${slug}-${cc}` dedupe logic. New cities become permanent records the moment the first user picks them — the table grows organically and stays canonical.

**Add "Primary city + also open to" multi-select.** One required primary `city_id` (already exists). New `also_cities uuid[]` column for up to 4 additional cities. Searching "Chicago" still matches; searching "Detroit" *also* matches if the poster checked "open to nearby/remote-friendly cities." This unlocks cross-city collabs without changing the index card UI.

**Keep the existing `location_mode` enum** (`online | in_person | hybrid`) — it composes cleanly with multi-city: `hybrid + primary=Chicago + also=[NYC, LA]` reads exactly right.

**Why this scales to 100M:** city rows are deduped by slug-cc, OSM is the single source of truth, no manual seeding, and the `also_cities` array stays small (max 4) so GIN-index lookups are cheap.

---

### 2. Timeline: structured underneath, freeform on top

Keep the vibes input — add structure beside it.

New columns on `collab_posts`:
- `timeline_mode` enum: `asap | by_date | window | ongoing | flexible`
- `starts_on date` (nullable)
- `ends_on date` (nullable)
- `timeline_text text` stays — it's the human-readable note ("evenings only, async OK")

UI: a row of mode chips, then date pickers that appear conditionally:
- **ASAP** → no dates, badge says "Starting now"
- **By date** → one date picker ("Need someone by Jun 12")
- **Window** → start + end ("Jun 10 – Jul 1")
- **Ongoing** → no dates ("Open-ended")
- **Flexible** → no dates ("Whenever")

Freeform `timeline_text` becomes a small optional "Anything else about timing?" field below.

**Why this matters for launch:**
- Sort by urgency (`starts_on ASC NULLS LAST` for ASAP/By date)
- Auto-close `by_date` posts whose `ends_on < today` (cron, reuses existing `expires_at` plumbing)
- Filter chip on the board: "This week" / "This month" / "Anytime" derived from structured dates, not regex on text
- Card UI shows a clean badge ("By Jun 12") instead of whatever the user typed

---

### 3. Scale hygiene while we're in here

- **Index:** `CREATE INDEX collab_posts_starts_on_idx ON collab_posts (starts_on) WHERE status = 'open';` — partial index, tiny, makes the "soonest" sort fast.
- **Index:** `CREATE INDEX collab_posts_also_cities_gin ON collab_posts USING GIN (also_cities);` for multi-city filter.
- **Validation:** Zod schema on the server fn enforces `starts_on <= ends_on`, `also_cities.length <= 4`, no duplicates with `city_id`.
- **Slug collisions:** already handled by the existing `collab_autoslug` trigger — no change.
- **City inserts:** wrap in the existing race-safe pattern from `resolveVenueAndCity` (try insert, on conflict re-select).

---

### Files

**Migration** (one file):
- Add `also_cities uuid[]`, `timeline_mode`, `starts_on`, `ends_on` to `collab_posts`
- Create `timeline_mode` enum
- Add the two indexes above

**New:**
- `src/components/city-combobox.tsx` — Photon-backed typeahead, returns `{ name, country_code, lat, lng, osm_ref }`. Reusable across `collab.new`, `collab.index`, and eventually `me.edit`.
- `src/lib/cities.functions.ts` — `resolveCityFromOSM` server fn (find-or-create, returns `city_id`).
- `src/components/timeline-picker.tsx` — mode chips + conditional date inputs.

**Edited:**
- `src/routes/collab.new.tsx` — swap City `<select>` → `CityCombobox`, add "Also open to" multi-picker (max 4), add `TimelinePicker`, demote `timeline_text` to optional note.
- `src/routes/collab.index.tsx` — filter chips can now use structured `starts_on` for "This week / month."
- `src/components/collab-card.tsx` — render structured timeline badge when present, fall back to `timeline_text`.

---

### Deliberately NOT in this pass

- **No city merging UI.** OSM gives us canonical slugs; duplicates are vanishingly rare with `${slug}-${cc}`. If two emerge, an admin SQL one-liner fixes it. Don't build a merger before there's data to merge.
- **No timezone on dates.** Dates are local-to-the-poster; rendering shows "Jun 12" without TZ math. Add TZ only when scheduling/notifications need it.
- **No timeline on the filter UI yet.** Ship the structured fields first, add the "This week" chip in a follow-up once data exists.
- **No Mapbox/Google.** OSM/Photon is keyless, already in use, and fine to 100M. We can layer a paid geocoder later if rate limits bite — the `osm_ref` column means we won't have to re-resolve.

---

### Open question for you

For **"Also open to" cities** — do you want it surfaced on the post-a-call form as a visible secondary picker (clear, but adds UI weight), or hidden behind a "+ open to other cities" disclosure that expands on click? I'd lean disclosure for v1 cleanliness, but the explicit version drives more cross-city matches.