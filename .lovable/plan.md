## Goal
Merge the event header card and the location card on the event detail page into a single, cohesive module. No functional changes — pure layout consolidation.

## Why
There's no structural reason to split "what/when/who" from "where." Splitting them creates two floating cards with duplicated padding, a visible gap, and weakens the hero. One unified card reads faster and looks intentional.

## Scope
Only `src/routes/g.$slug.e.$eventSlug.tsx`. `EventLocationCard` stays as-is for reuse elsewhere; we just inline an equivalent location row into the header card here (or render `EventLocationCard` inside the same card with borderless styling via a prop).

## Changes

**`src/routes/g.$slug.e.$eventSlug.tsx`**
- Remove the standalone `<div className="mt-5"><EventLocationCard .../></div>` block.
- Inside the existing header card (the `rounded-3xl border ... p-6` block), add a divider (`border-t border-border`) below the Host / Report / Share row, then render a compact location section:
  - Row with `MapPin` icon + IN PERSON / ONLINE / HYBRID label (uppercase, muted, same styling as current card)
  - Venue name (bold) + address line, OR "Join online" link for online/hybrid
  - Reuse the existing helper logic from `EventLocationCard` inline (small enough — format, venueName, venueAddress, onlineUrl)

**Optional cleaner variant:** add a `variant?: "card" | "embedded"` prop to `src/components/event-location-card.tsx` where `embedded` drops the outer `rounded-3xl border bg-surface shadow-soft p-*` wrapper, then render `<EventLocationCard variant="embedded" .../>` inside the header card with a `border-t` separator. This preserves the single source of truth for location rendering.

I'll go with the **embedded variant** approach — cleaner, no duplication.

## Result
One unified hero card: category chip → title → tagline → date/time → host row → divider → location. Everything below (Series admin strip, RSVP block, companion, Who's going, tabs) stays exactly where it is.

## Out of scope
- No changes to RSVP, tabs, or any other module
- No visual restyling beyond removing the split
- Reserving a broader "considered pass on the event page" for a follow-up once this lands
