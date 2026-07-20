## Problem

On the event detail page (`src/routes/g.$slug.e.$eventSlug.tsx`), the info card (title, date, host, share) is pulled up over the cover image with `-mt-10`. On tall/portrait cover art like the TBD Comedy Open Mic poster, that overlap crops the bottom of the image and hides part of the artwork, while still leaving the card visually anchored to the hero.

The user wants both: the full cover image visible AND the info card still reading as one continuous banner (they like the gradient fade into the card).

## Change

Single file: `src/routes/g.$slug.e.$eventSlug.tsx`, hero + info-card block (lines ~173–204).

1. Drop the negative overlap on the info card so it sits fully below the cover:
   - `mx-auto -mt-10 max-w-2xl px-4 md:px-6` → `mx-auto mt-6 max-w-2xl px-4 md:px-6`
2. Keep the existing bottom gradient (`from-black/30 via-transparent to-background`) so the cover still fades cleanly into the card background — visually the "banner cut out of the header image" the user described, without covering the artwork.
3. Leave hero height, back chip, and status chip untouched. No other files change.

## Out of scope

- No changes to cover aspect ratio, object-fit, or upload flow.
- No changes to the info card's internal layout, chips, or share actions.
- No mobile-only or desktop-only branching — the fix applies to both.
