## Profile 2027 — portfolio-grade redesign

Reframe `/u/:username` from a generic tabbed dashboard into a portfolio surface the user actually wants to share. Tighter IA, richer Works grid, in-page lightbox, and a hero that does work.

### 1. Information architecture (tabs)

Collapse 8 tabs → **4**:

| New tab | Folds in | Notes |
|---|---|---|
| **Works** | Works + **Credits** | One unified portfolio. Role filter chip: *All · Created · Credited*. Credits are no longer a separate tab — they're Works you appear on, filterable. |
| **Collabs** | Collabs | Unchanged. |
| **Activity** *(own only)* | **Drafts** + **Workshops** + existing Activity (applied / participating) | Single chronological feed grouped by section: *Drafts · Workshops · Applied · Participating*. Private — never shown to visitors. |
| **About** | About + **Groups** | Groups become a subsection of About (city/home chips inline with bio). |

Visitor sees only: Works · Collabs · About. Owner additionally sees: Activity.

Default tab: **Works** for everyone (own and visitor). Drop the "first non-empty visitor tab" logic — a portfolio always opens on Works.

### 2. Works tab — real portfolio grid

- **Pinned hero row** stays, but upgrade to a true masonry feel: 2-up on desktop with one optional "spotlight" slot (first pinned renders larger / 16:10).
- **Filter bar** above the grid, single row:
  - Role chips: *All · Created · Credited* (drives the merged Works+Credits dataset).
  - Category chips (existing `MediumChip`), only render when >1 category present.
  - Sort dropdown on the right: *Recent · Oldest · Most loved*.
- **Card upgrades** (in `work-card.tsx`, not new component):
  - Hover state reveals title + category + year overlay on the cover, Behance/Cargo style.
  - "Credited" cards get a subtle corner badge with the owner's role (e.g. "Editor", "Co-writer").
- **Empty filtered state**: clear copy + reset chip.

### 3. Lightbox — open any Work in place

New `<WorkLightbox>` component (Radix Dialog, full-viewport).

- Click any card on the profile → opens lightbox instead of navigating.
- Left/right arrow keys + on-screen chevrons cycle through the *currently filtered* Works list.
- URL syncs via search param: `?w=<slug>` (deep-linkable, shareable, back button closes).
- Contents: cover/embed at top (image, YouTube/Vimeo/Spotify/SoundCloud via existing `EmbedPlayer`, book cover for `writing_book`), title, byline, category chip, description, buy links for books, collaborators row, love/comment counts, "Open full page →" link to `/works/$slug`.
- Mobile: full-screen sheet, swipe to dismiss.
- Esc / backdrop click closes and clears `?w=`.

### 4. Hero refresh

The current hero (name + handle + city + 3 action buttons + completion chip + stat row) reads as a settings page. Tighten it:

- **Name** (display serif, unchanged) + **@handle** · **city** inline beneath.
- **Bio one-liner** (first ~140 chars of about) rendered directly under handle when present — currently buried in About tab.
- **Avatar** (40px) inline with handle row if `avatar_url` set; placeholder initial otherwise.
- **Action row** condensed: primary CTA only (`Publish` for own, `Follow` for visitor), secondary actions in a `…` menu (Post Collab, Drop into Workshop, Share, Report).
- **Stats row**: drop "Credits" as its own stat (now folded into Works count). Keep: *Works · Worked with · Followers · Following*. Numbers stay serif but tighter — currently feels like a counter strip, should feel like portfolio metadata.
- **Completion chip** stays but moves to a dismissable inline note under stats (own only, only when <100%).

### 5. Share affordance

- Add a small `Share` icon button in the hero (own + visitor) that copies the canonical URL (`workshopindie.com/u/<handle>`) and shows a toast. This is the "send a link" muscle memory.
- Set `og:image` on the profile route using the user's `cover_image_url` (fall back to first pinned Work cover, then default).

### 6. Out of scope

- No new DB fields. Credits already queryable; reusing `creditedWorks` dataset.
- No edits to `/works/$slug` detail page — it remains the canonical permalink.
- No changes to category color tokens.
- Profile editing flow unchanged.

### Files

- `src/routes/u.$username.tsx` — tab reduction, hero refresh, share button, lightbox state + URL sync, merged Works+Credits dataset, Activity merge (Drafts + Workshops in).
- `src/components/work-card.tsx` — hover overlay, credited badge variant.
- `src/components/work-lightbox.tsx` — new.
- `src/routes/__root.tsx` *(only if og:image needs leaf-level override pattern)* — likely untouched; head() lives on the profile route already.

### Open question before build

The Activity tab will grow long once Drafts + Workshops + Applied + Participating all live there. Want it as:
- **(a)** one chronological mixed feed with type icons, or
- **(b)** four collapsible sections in fixed order (Drafts → Workshops → Applied → Participating)?

I'd lean **(b)** — easier to scan, matches how the user actually thinks about each pile. Confirm or override before I build.
