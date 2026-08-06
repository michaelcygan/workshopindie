# Influences — a small shelf of what shaped you

Works = what I make. Influences = what shaped me. Up to 10 per profile, managed only in Edit Profile, invisible on the public profile until a creator adds one.

## What I found in the current code

- `src/routes/u.$username.tsx` drives tabs from `TAB_VALUES = ["works","blog","collabs","activity","about"]`, a `counts` record, and a `visibleTabs` filter that already hides Collabs/Blog when empty. Adding a conditional tab fits this exactly.
- `src/routes/me.edit.tsx` uses `type SectionId = "identity" | "mediums" | "location" | "links" | "pinned"` plus a `SECTIONS` array and a shared `<Section>` wrapper with sticky section nav. Influences slots in as a sixth section id.
- `src/components/pinned-works-picker.tsx` already has the numbered position + up/down + remove grammar to reuse.
- `src/lib/works-import.functions.ts` holds all URL metadata logic (provider detection, oEmbed, OpenGraph scrape with 4s timeout and 256KB cap, tracking-param stripping, category mapping) but it is all private inside that one file — it needs extraction, not duplication.
- `src/lib/moderation/url-blocklist.ts` already exists with adult/extremist host + suffix lists, browser-safe and network-free. Influences reuses it directly.

## Wave 1 — Foundation (no visible UI change)

Database migration creating `public.profile_influences`:

- `id`, `profile_id` (FK to profiles, cascade), `position` int, `source_kind` text (`workshop_work` | `external`), `work_id` (FK to works, ON DELETE SET NULL), `external_url`, `normalized_url`, `title`, `creator_name`, `category`, `thumbnail_url`, `provider`, `created_at`, `updated_at` + updated-at trigger.
- Constraints: a check that `workshop_work` rows carry `work_id` and `external` rows carry `external_url`; unique `(profile_id, work_id)` and unique `(profile_id, normalized_url)` partial indexes; index on `(profile_id, position)`.
- A `BEFORE INSERT` trigger rejecting an 11th row per profile — server-side, race-safe, not just a React check.
- GRANTs (`authenticated` full, `anon` select) then RLS: owner can insert/update/delete their own rows; anyone may read rows for profiles they can already view. No change to existing profile/work policies.

Shared URL metadata module:

- Extract the reusable pieces of `works-import.functions.ts` into `src/lib/url-metadata/` (provider detection, category mapping, oEmbed, OpenGraph scrape, entity decoding, tracking-param cleaning). `extractWorkFromUrl` keeps its exact current signature and behaviour and simply calls the extracted module, so Work publishing is untouched.
- Harden that shared fetch layer once, for both callers: reject non-http(s) schemes, localhost, loopback/private/link-local/internal hosts, malformed URLs; follow redirects manually and re-validate each hop; keep the existing timeout and body cap; clamp title/creator lengths; only accept https image URLs as thumbnails.
- Deterministic safety gate using the existing `url-blocklist` host/suffix sets, applied before any network call so blocked domains are never even fetched. Blocked attempts get logged into the existing moderation event trail (host only, no raw text).

## Wave 2 — Edit Profile management

- New `influences` section id inserted between Mediums & bio and Location & languages, using the existing `Section`/`SECTIONS` pattern and sticky nav.
- Copy: "Works, artists, books, films, records, ideas, and other things that shaped your practice. Optional — choose up to 10." plus a subtle `+ Add influence` and a quiet "4 of 10".
- Compact rows mirroring the pinned-works grammar: number, thumbnail, title, `Creator · Category`, up/down/edit/remove.
- Add dialog with two paths: **Workshop Work** (search across works the visitor can actually see — published, public/unlisted only) and **Link** (paste URL, resolve metadata, show an editable confirm state with thumbnail/title/creator/category/provider, fall back to manual fields when resolution fails).
- All mutations are dedicated server functions with their own TanStack Query invalidation — add/edit/remove/reorder persist immediately and never depend on the global Save profile button.

## Wave 3 — Public profile

- Add `influences` to `TAB_VALUES` between works and blog, feed `counts.influences` from a lightweight count, and extend `visibleTabs` with `if (t === "influences") return influenceCount > 0` — same rule for visitors and owner. Zero influences means the tab does not exist. No empty state, no nudge, ever.
- New `InfluenceCard` (not `WorkCard`): thumbnail, title, creator, category chip, subtle source label (Workshop, or the provider/domain). No likes, saves, views, comments, or authorship framing. Workshop-work influences link to the Work page; external ones open in a new tab with `noopener noreferrer nofollow ugc`.
- One query for the whole tab, joining live Work data where the influence points at a Work, so a profile never fans out into ten requests. External metadata is served from the stored snapshot — no scraping on page render.
- Graceful degradation: a Work that became private, unpublished, or deleted renders from the stored snapshot fields or is skipped, never crashes the profile. Missing thumbnails fall back to the existing category visual language.

## Wave 4 — Safety and polish

Audit pass across: SSRF hardening, adult-domain blocking, RLS, deleted/unpublished Work behaviour, logged-out and blocked-user access, ordering after deletion, duplicate handling, responsive overflow, keyboard/ARIA on add/edit/remove/move controls, and regression checks on Work URL import, Edit Profile save, and profile tab/scroll behaviour. Reporting reuses the existing ReportDialog entity pattern if it accepts a new type cleanly; otherwise profile reporting stays the path and admins remove rows directly.

## Notes

- `profile_influences` stays row-shaped with `work_id` / external snapshot columns so a future shared cultural-object table could be introduced by adding a nullable `object_id` — no migration dead-end, but nothing of that is built now.
- Explicitly not built: liking, commenting, feeds, recommendations, global influence search, analytics, Plus gating, public add buttons, standalone influence pages.
