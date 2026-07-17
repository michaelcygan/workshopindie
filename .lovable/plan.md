Two small, mobile-only polish fixes to `src/routes/u.$username.tsx`. No schema, routes, or business logic changes.

## 1. Header layout — stop the name/actions squish

Current problem: on narrow widths (IG in-app browser, 390px), the name row and the mobile action stack (Follow on top, Share/Report/Block below) both compete for horizontal space. When "Michael Cygan" plus Follow don't fit cleanly, the name wraps or leaves ugly dead space under it.

Fix — make the identity row a real responsive grid with a shrinkable name column:

- Wrap the mobile name + actions row in `grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3` so the name column always gets remaining width and the action column stays at intrinsic width (never wraps under).
- Name `<h1>`: add `min-w-0 text-balance`, scale from `text-[20px]` → `text-[22px]` → `md:text-4xl` via `text-[clamp(20px,6vw,26px)]` on mobile so it fits at 320–430 without forcing the sibling column to wrap.
- Mobile Follow button: use `size="sm"` with `px-3` and a `shrink-0` wrapper so it hugs the top-right without pushing the name.
- Second action row (Share / Report / Block on visitor view; Edit on owner view): render right-aligned, `flex-nowrap justify-end`, using icon-only buttons with `aria-label`s under `sm:` (keep the labelled versions from `sm` up). This removes the stacked "Share · Report" block that sits ugly under the name today and keeps the whole action cluster in a single tight column.
- On owner view, the mobile Edit affordance stays as the compact pencil pill already used elsewhere; no change to desktop.

Verify at 320 / 360 / 375 / 390 / 430 with short and long display names — no wrap, no dead space, no horizontal overflow. Desktop (`md:` and up) layout is untouched.

## 2. Open-to-collaborate pill — behave like a new-collab alert

Current problem: the pill is shown whenever the visitor is not on the Collabs tab AND there are open collabs. It reappears every time the user leaves the Collabs tab.

Fix — treat it as a dismissable alert keyed by "latest collab you've seen":

- Compute `latestCollabKey` = max `created_at` (or fallback `id`) across `openCollabs` for this profile.
- Persist `dismissed:${profile.id}` → `latestCollabKey` in `localStorage` (SSR-safe via `useEffect` hydration, matching the pattern used elsewhere in this file).
- Show the pill only when: mobile, visitor, `openCollabs.length > 0`, current tab ≠ `collabs`, AND the stored key ≠ `latestCollabKey` (i.e. there's an unseen collab).
- Dismiss on first interaction: clicking the pill (which already switches to the Collabs tab) OR switching to the Collabs tab by any other means writes `latestCollabKey` into storage, so it stays gone across tab switches until a newer collab appears.
- Add a small `×` on the pill that dismisses without navigating, using the same storage write, for users who don't want to open Collabs.

No changes to the Collabs tab content, application flow, or collab queries — just the visibility gate of the mobile alert pill.

## Technical notes

- Files touched: `src/routes/u.$username.tsx` only.
- No new dependencies. Uses existing `useEffect`, `localStorage`, `cn`, `Button` primitives.
- Verify via preview at mobile widths that:
  - name never wraps into the button; no empty band below name
  - pill disappears after first tap on the Collabs tab and does not return on Works/Activity/About
  - pill reappears if a new collab (newer `created_at`) is added
  - desktop profile is visually identical to today
