## Wave 4 — Seed language-specific Groups

Seed six public `scene` Groups so multilingual creators have a home immediately. Uses the existing Group system unchanged (no new tables, no new UI).

### Seed set

| Slug | Name | Tagline |
|---|---|---|
| `creadores-en-espanol` | Creadores en Español | Comunidad de creativos hispanohablantes |
| `createurs-francophones` | Créateurs Francophones | Communauté créative francophone |
| `criadores-em-portugues` | Criadores em Português | Comunidade criativa lusófona |
| `kreative-auf-deutsch` | Kreative auf Deutsch | Deutschsprachige Kreativ-Community |
| `creativi-in-italiano` | Creativi in Italiano | Comunità creativa italofona |
| `nihongo-creators` | 日本語クリエイター | 日本語で活動するクリエイターのコミュニティ |

Each row:
- `kind = 'scene'`, `visibility = 'public'`, `join_mode = 'open'`
- `is_official = true` (Workshop-curated)
- `created_by = NULL` (system-seeded; matches existing seeded scenes)
- `description` = one short paragraph in the group's language inviting members to introduce themselves, share Works, and start Lounges in that language.
- No `city_id`, no cover art (admins can add later via `/admin/groups`).

Insert with `ON CONFLICT (slug) DO NOTHING` so re-running is a no-op.

### Technical details

- Single migration: `INSERT INTO public.groups (slug, name, tagline, description, kind, visibility, join_mode, is_official) VALUES (...) ON CONFLICT (slug) DO NOTHING;`
- No schema changes. No RLS/GRANT changes (existing `groups` policies already handle public read + admin write).
- Nothing to change in app code — these appear automatically in `/g`, admin `/admin/groups`, and search.

### Out of scope

- Cover art / avatars (admin can upload later).
- Auto-adding members.
- Language filtering UI anywhere else (was explicitly deferred).