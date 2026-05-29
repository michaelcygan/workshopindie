# City page → Workshop hub

Make the City page the connection layer for each scene: one primitive (Workshop), one button ("Post a Workshop"), city-scoped audience, with a clean Live / Scheduled / Standing view. Admins can pin a Workshop to turn it into a standing one for that city.

## 1. Header CTA + entry point

In `src/routes/cities.$slug.tsx`:

- Replace **"Start a standing meetup"** button with **"Post a Workshop"** (`Plus` icon). Always visible (auth-gated via redirect on click for logged-out users).
- Keep "Post a collab" outline button next to it.
- Remove the inline `NewMeetupForm` and `showMeetupForm` toggle. Clicking "Post a Workshop" opens a **city-scoped Workshop sheet** (`Dialog` from `@/components/ui/dialog`) anchored to this city.
- Remove the "Scheduled workshops are coming soon" footer line — it's no longer true.

## 2. New `<PostWorkshopFromCitySheet>` (single new component)

Lives in `src/components/post-workshop-from-city-sheet.tsx`. Self-contained — does not navigate away. Props: `{ city: { id, name, slug }, isAdmin: boolean, open, onOpenChange }`.

Form is intentionally tight (1 screen, no scroll on desktop):

1. **From a Collab? (optional)** — at top. Combobox loading `collab_posts where user_id = me order by created_at desc limit 20`. Selecting one pre-fills title / category / prompt and stores `topic_collab_post_id`. Clear button to go back to blank.
2. **Title*** + **Category** chips (existing `CATEGORIES`).
3. **When*** — segmented toggle: **Right now** | **Schedule**. If "Schedule", reveal start + end datetime inputs (default tomorrow 6–8pm). If "Right now": `mode='instant_spawned'`, `status='active'`, `starts_at = now`, `ends_at = now+2h`.
4. **Where*** — segmented toggle: **Online** | **IRL**. If "IRL", show `VenueSearch` (already exists, resolves to `city_id` via `resolveVenueAndCity`). If "Online", optional Zoom/Meet URL input.
5. **Seat cap** — number, default 6.
6. **Admin only**: a checkbox **"Pin as a standing Workshop for {city.name}"** (sets `is_pinned=true`). Hidden for non-admins.
7. Submit → "Post Workshop".

### City-scope enforcement (the core of the request)

Every Workshop posted via this sheet is **locked to this city's audience**:

- `city_id = city.id` (even for online — used for discovery scoping).
- `audience_city_ids = [city.id]` (already exists on the table; powers "only users of that city can see/join").
- For **IRL**: also fill venue fields from `VenueSearch`; if venue resolves to a different city, show inline error "Venue is outside {city.name} — pick a venue in {city.name} or switch to Online".
- `location_type = 'online' | 'in_person'` (drop "hybrid" from this entry point — keep it on the generic `/workshops/new` if needed).

Submit path: direct `supabase.from('workshops').insert(...)` for "Schedule" mode (same shape as `workshops.new.tsx`), and for "Right now" reuse the same insert with `mode='instant_spawned'` + immediately call `ensureWorkshopRoom` (existing) to spawn the paired `instant_rooms` row, then navigate to `/instant/$id`. The host is inserted as a confirmed participant either way.

If a Collab was selected, also UPDATE `collab_posts.live_workshop_id = ws.id` so the Collab page's existing "live workshop" wiring lights up. Owner check: we only list the user's own Collabs in step 1, so this is safe.

After insert, close the sheet and toast "Workshop posted in {city.name}". Stay on the City page (with the new row appearing in the Workshops section below). For "Right now", instead navigate straight into the room.

## 3. "Workshops" section (replaces "Standing meetups")

Section heading: **Workshops in {city.name}**.

Tabs (CategoryScroller pattern): **All · Live · Scheduled · Standing**.

- **All**: union of below, ordered: Live first, then Standing (pinned), then upcoming Scheduled by `starts_at asc`.
- **Live**: `mode in ('instant_spawned','scheduled') AND status='active'`.
- **Scheduled**: `mode='scheduled' AND status in ('open','check_in') AND starts_at >= now`.
- **Standing**: `is_pinned = true` (admin-curated).

Query: `workshops` filtered by `city_id = city.id OR city.id = ANY(audience_city_ids)`, `visibility='public'`. Use existing `WorkshopCard` component (`src/components/workshop-card.tsx`).

Each card shows a small chip row delineating **🟢 Live now** / **📅 {when}** / **📌 Standing**, and **🌐 Online** / **📍 {venue or "IRL"}** so online vs IRL is instantly readable in the city feed.

Empty state per tab is honest ("No live Workshops right now — post one") with a button that opens the same sheet.

The legacy `standing_meetups` table and its rendering block are **dropped from this page**. They keep existing in the DB (no migration to remove rows) but the City page no longer reads or writes them. The old hosts can be migrated later; this is intentional to consolidate around one primitive.

## 4. Admin pin (the only DB change)

Add `workshops.is_pinned boolean default false` and `workshops.pinned_at timestamptz`. RLS update so only admins can flip `is_pinned`:

- New policy `admins pin workshops` (UPDATE, USING/WITH CHECK = `has_role(auth.uid(),'admin')`) is already covered by the existing `admins manage workshops` ALL policy → no new policy required, just verify it exists. If it doesn't, add it.
- A small column-level guard via trigger: prevent non-admins from setting `is_pinned=true` even on their own workshops.

The City page renders a small "📌 Pin" / "Unpin" button on each Workshop card **only when `useUserRoles().isAdmin`** — toggles `is_pinned` + `pinned_at`. This is the entire "create standing Workshops in the city flow for now" surface — no separate flow needed.

## 5. Files touched

- `src/routes/cities.$slug.tsx` — swap header CTA, remove inline meetup form, replace meetups section with Workshops section + tabs + pin button, add Workshop queries by `city_id`/`audience_city_ids`, drop "coming soon" line.
- `src/components/post-workshop-from-city-sheet.tsx` — new component (all of section 2).
- `src/components/workshop-card.tsx` — add small `chips` slot for Live/Scheduled/Standing + Online/IRL pills if not already present (light tweak only).
- One migration: `alter table workshops add column is_pinned boolean not null default false, add column pinned_at timestamptz; create index on workshops (city_id, is_pinned) where is_pinned;` + trigger blocking non-admin pin writes.
- No changes to `src/routes/workshops.new.tsx` (kept as the power-user scheduler) or the global "Post a Collab" button in the top nav.

## Out of scope (intentional)

- Migrating existing `standing_meetups` rows into pinned Workshops — can be a follow-up.
- Recurring/repeating Workshops (RRULE) — pin is a lighter primitive that gets us standing-Workshop behavior today.
- Cross-city Workshops — this flow is intentionally single-city. The generic `/workshops/new` still supports `audience_city_ids` with multiple cities for power users.
- Touching the global top-nav "Post a Collab" button or the Collab page Workshop spawn (already covered by `openWorkshopOnCollab`).