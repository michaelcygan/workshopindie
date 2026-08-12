# Cover photos for the remaining Chicago events

Chicago currently has 41 event series. 21 already have cover photos; **20 series (about 90 individual event occurrences) still have none** and render as blank/placeholder cards.

Series still missing a photo:

- Art & Craft Night at Eli Tea Bar / Open Mic Fridays / Monday Night Writers Group — Eli Tea Bar Chicago
- Drop-In Figure Drawing at Platform Studios (Tue/Wed/Thu series)
- Open Mic Night at Fuller's Pub (Wed + Thu series)
- Chi Hack Night
- South Side Hackerspace Open House
- Do Not Submit — Lakeview (Olive Black) and — Andersonville (Hopleaf Bar)
- ChiPy `__main__` Meeting (Slalom Build)
- Digital Delivery Chicago (Aon Center)
- AIGA Chicago Co-working Days (Long Room) and Coffee & Crits (Friendly Coffee Lounge)
- Story Lab Chicago (Mrs. Murphy & Sons)
- Queer Book Club at Unabridged Bookstore
- South Side Zine Fest + Carnival (CPL Daley Branch)
- Move + Reading Night at the Wild Mile
- Fun Run Before the Author Talk (Fine Arts Building)

## Approach

Match exactly how the existing 21 Chicago covers were done:

1. For each series, source one image — the event's own promo image where the organizer publishes one, otherwise a photo of the venue.
2. Apply the same brand treatment as the current covers, crop to the standard landscape ratio, and upload to the covers storage bucket under `events/chicago/<venue-or-event-slug>.jpg`.
3. Set `cover_url` plus `photo_credit_name` and `photo_credit_url` (organizer or venue site) on **every occurrence** in each series, so recurring dates all inherit the same image.
4. Series sharing a venue (the three Eli Tea Bar series, the two Fuller's Pub series, the three Platform Studios series) reuse a single venue image, exactly like Gallery Cabaret and Green Mill do today.

## Notes

- Credit is always attributed to the venue or organizer with a link back, consistent with existing rows.
- Purely online events (Chi Hack Night) get an organizer/community image rather than a venue shot.
- No schema or UI changes; this is data only — event cards and OG images already read `cover_url`.

## Verification

Re-run the coverage query afterward to confirm zero Chicago series without a cover, and spot-check the `/events` board and a few event pages in the preview.
