Create a single official "Workshop Street Team" group via the insert tool (no schema change needed).

Row:
- `slug`: `workshop-street-team`
- `name`: `Workshop Street Team`
- `tagline`: `Help grow the platform, IRL and online.`
- `description`: `For folks who want to join the Workshop street team — help spread the word about the platform. Printable signs and QR codes, coordinated announcements, on-the-ground meetups, and more. Jump in if you want to help creators find Workshop.`
- `kind`: `scene`
- `category`: `scene_life`
- `is_official`: `true`
- `join_mode`: `open`
- `visibility`: `public`
- `created_by`: Michael Cygan's profile id (looked up by handle), so it has a proper owner. If that lookup returns nothing, insert with `created_by = NULL` (allowed).

Nothing else changes — no migration, no code edits.
