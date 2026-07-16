
Scope: presentation-only changes in `src/routes/u.$username.tsx`, active below the existing `md` breakpoint. Desktop layout, data fetchers, tab state, filtering, sharing, Collab detail flow, and the DM/apply behavior are untouched.

## What changes on mobile (`< md`)

### 1. Tighter header stack
- Reduce cover height (`h-40` on mobile, keep `md:h-80`).
- Avatar becomes `h-20 w-20`, overlap `-mt-10`.
- Action buttons (Follow, Message, Share, Report, Block on visitors — Share + Edit on owner) collapse to a single icon-button row that sits inline with the avatar, no wrapping. Existing components reused; only the `size` and label-hiding change on mobile.
- Name / handle / location / headline collapse into a compact 3-line block. Aliases + tools chips hide on mobile (they remain in About).
- Owner-only "Post to Gallery / Post a Collab / Drop into a Lounge" row hides on mobile (still visible `md:flex`); the completion chip and wrap-up nudge also move below the tab bar on mobile so the first screen leads with imagery and identity.

### 2. Compact link row (reuses existing fields)
- New small presentational component `LinkPills` inside the same file. On mobile only, renders a horizontally scrollable row of pill buttons built from:
  - `profile.instagram_handle` → Instagram pill (existing `Instagram` icon from `lucide-react`).
  - Each `profile.external_links[]` entry → pill using the saved label (falls back to hostname) and a generic `Link` icon; special-cased icons for common hosts (youtube, tiktok, x/twitter, spotify, soundcloud, bandcamp, vimeo, github, substack, are.na) picked from `lucide-react`.
- No new DB fields, no link-management UI, no provider registry beyond the icon lookup table.
- Placed directly under the identity block, above the artist statement.

### 3. Artist statement lifts above the portfolio
- The existing `blockquote` for `artist_statement` (already conditionally rendered) is kept where it is — on mobile it sits directly below the link row and above the tab bar, matching the current DOM order. Typography scales down a touch on mobile (`text-lg` vs `text-xl md:text-2xl`).

### 4. Category tiles → existing Work filter
- Inside `WorksTab`, on mobile only (`md:hidden`), when `activeCat === "all"` and `roleFilter === "all"`, render category tiles instead of the desktop chip strip + 3-col grid:
  - One tile per entry in `availableCats` (derived from the merged Works — already computed).
  - Each tile is a full-width vertical card (`aspect-[3/2]`) stacked in `space-y-3`.
  - Cover source, in order: cover of the top pinned Work in that category (from `pinnedWorks`), else cover of the most recent published Work in that category (from `filtered`/`roleFiltered`), else the existing category color via `categoryClass(cat)` used as the tile background.
  - Overlay: category label + count in the same type scale as the existing hero card.
  - Tapping a tile calls `setActiveCat(cat)` — reuses the existing local filter state. The grid then renders the same `WorkCard` list already used.
  - When a category is active on mobile, show a small "← All categories" button that calls `setActiveCat("all")` to return to the tile view. Sort dropdown remains available.
- Desktop keeps the current chip + grid layout unchanged (tiles are `md:hidden`, the chip strip stays `hidden md:flex`).
- Pinned strip continues to appear above the tiles on mobile only when it's non-empty AND at least 2 pinned pieces exist, so we don't double up when there's only one Work.

### 5. Open Collabs banner (mobile only)
- Above the tab bar on mobile, when `!isOwn && (openCollabs?.length ?? 0) > 0`, render a single compact pill/button: `Open to collaborate · N Collab{s}`.
- Tapping it calls `setTab("collabs")` — reuses the existing tab route + Collabs list. Nothing renders when there are no open Collabs.
- Owners: the same pill shows with an "Open" label but taps switch to the Collabs tab too (no apply implication for them). No banner appears on desktop.

### 6. Secondary info drops below portfolio on mobile
- The existing "Stats strip" (Gallery / Worked with / Followers / Following) moves below the tabbed content on mobile via a second render slot (`md:hidden`) — the desktop copy stays where it is (`hidden md:flex`).
- Tools chip row and aliases already hidden per §1; they remain visible in the About tab.
- The About tab, Groups section, and Frequent Collaborators are unchanged and remain reachable via the tab bar.

### 7. Collab apply flow — mobile spacing check only
- Read `src/routes/collab.$slug.tsx` to confirm the existing "I'm in" action, short application note, and DM handoff are already gated on `!isOwner` (line 296 shows `isOwner = user?.id === post.user_id`; owner CTAs render under `isOwner &&` and visitor CTAs under `!isOwner &&`, so owners already cannot apply — no logic change).
- Apply small mobile-only tweaks in that file: full-width primary button below `sm`, dialog padding tightened (`p-4 sm:p-6`), and the application note textarea gets `text-base` on mobile to prevent iOS zoom. No new state, no new dialogs.

## Non-goals (explicitly out of scope)
- No new tables, columns, RLS, functions, migrations, or Supabase queries.
- No new route files, no changes to `routeTree.gen.ts`, no auth changes.
- No QR codes, camera, or event-networking mode.
- No new npm dependencies (all icons come from `lucide-react`, already installed).
- No redesign of `WorkCard`, `CategoryChip`, `ShareSheet`, `MessageButton`, `FollowButton`, or the Collab detail page beyond the spacing tweaks above.
- Desktop layout at `md+` is unchanged pixel-for-pixel.

## Files touched
- `src/routes/u.$username.tsx` — the mobile changes above; adds one internal `LinkPills` component and one internal `CategoryTiles` component in the same file.
- `src/routes/collab.$slug.tsx` — small mobile spacing / textarea size tweaks only.

## Verification
- Playwright at 375×812 and 414×896: capture screenshots of a profile with Works across ≥2 categories, one with open Collabs, and one without; confirm no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), category tile tap reveals filtered Work cards, "Open to collaborate" pill switches to the Collabs tab, and the desktop viewport (1280×900) is visually identical to before.
- Verify owner viewing their own profile: no apply CTA visible on their own Collab detail page (existing behavior confirmed above); "Open to collaborate" pill hidden for anonymous visitors when no open Collabs.
