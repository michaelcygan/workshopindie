# Cover photos for Milwaukee's events

Milwaukee currently has 14 seeded event series (45 individual occurrences), and **none of them have a cover photo** — every card renders as a blank placeholder.

Series missing a photo:

- Cinematic Sisterhood: Dreams in Nightmares — Oriental Theatre (Herzfeld)
- Cinematic Sisterhood: Horsegirls — Oriental Theatre (Lubar)
- Dialogues Documentary Festival 2026 — Oriental and Downer Theatres
- Code & Coffee and Code + Brews — Mitobyte (venue varies per date)
- Comix Book Club — Lion's Tooth
- Miltown Game Developers: Saturday Workgroup (online)
- Milwaukee Makerspace Public Meeting — Lenox and — Norwich
- Milwaukee Sketch Club at the Milwaukee Public Museum
- Over the Prairie // Under the Prairie — Woodland Pattern
- Poetry in the Park — Juneau Park
- Readshop (online)
- Solitary Plover: Summer 2026 (online)

## Approach

Same treatment just used for Chicago, so the two cities look like one product:

1. One image per series, 1600x1000, documentary-style, natural light, no text or logos, low-saturation brand grade matching existing covers.
2. Try the organizer's own promo image first (MKE Film, Woodland Pattern, Lion's Tooth, Milwaukee Makerspace, Mitobyte). Where the site offers only a logo or nothing usable, generate a venue/scene-appropriate photograph instead — this is what the Chicago pass ended up doing for most venues.
3. Upload to the covers bucket under `events/milwaukee/<venue-or-event-slug>.jpg`.
4. Set `cover_url` on **every occurrence** in each series, plus `photo_credit_name` / `photo_credit_url` when a real organizer or venue image is used.

## Notes

- The three MKE Film series share the Oriental Theatre, so they reuse a single Oriental image where sensible; the two Makerspace locations get distinct images since the venues are genuinely different buildings.
- Online series (Readshop, Solitary Plover, Miltown workgroup) get an organizer-flavored image rather than a fabricated venue shot.
- Mitobyte's two series have no fixed venue, so they get a generic Milwaukee tech-meetup scene.
- Data only — no schema or UI changes; event cards and OG images already read `cover_url`.

## Verification

Re-run the coverage query afterward to confirm zero Milwaukee series without a cover, then spot-check `/g/milwaukee`, the `/events` board, and a couple of event pages in the preview.
