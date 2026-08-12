# Fix: Collab board says "Not accepting" for every card

## What's happening

The Collab board only lists collabs that are open to collaborators — the query already filters to `applications_open = true`. But the data it fetches for each card leaves that field out, so the card component sees "unknown" and falls back to the closed state, printing "Not accepting". The detail page fetches the full record and correctly shows "Accepting collaborators".

So the badge on the board is always wrong for open collabs; nothing is wrong with the underlying data or permissions (verified: the field is readable by both signed-out and signed-in visitors).

## The fix

Add the missing recruitment fields to the board's data fetch so the card can compute the same state the detail page does:

- `src/routes/collab.index.tsx` — include `applications_open` and `archived_at` in the `collab_posts` select (the card's state helper reads `status`, `archived_at`, `resulting_work_id`, `applications_open`, `ends_on`; only the first field set is currently missing).

## Guard against a repeat

The card silently degrades when a field is absent. Two small hardening steps:

1. Export a shared field list (e.g. `COLLAB_CARD_SELECT`) next to the card data type and use it from every surface that renders a collab card, so a new surface cannot miss a field.
2. Add a unit test asserting that an in-progress collab with `applications_open: true` reports the "accepting" state, and that the shared select string contains every lifecycle field.

## Verification

- Load `/collab` and confirm cards for open collabs read "In Progress · Accepting collaborators", and that a paused collab (if one exists) still reads "Not accepting".
- Confirm the detail page badge and the board badge agree for the same collab.
