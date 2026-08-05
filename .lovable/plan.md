# Mediums as connective tissue: System Medium Groups

Make creative categories automatically connect people and content into five official Workshop Groups — Music, Film & Video, Writing, Visual Art, Games & Tech — with no new user steps, no new taxonomy, and no new feed engine.

## What the audit found

- `src/lib/taxonomy.ts` is already the canonical taxonomy (`CanonicalCategory`, `normalizeCategory`, `WORK_CANONICAL_IDS`, legacy `film`/`visual`/`build`/`writing_book` mapping). `categories.ts`, `mediums.ts`, and `blog-categories.ts` all derive from it — `blog-categories.ts` already carries a `canonical` field per Blog slug. Nothing new is needed at the taxonomy layer beyond one granular-medium mapping.
- `groups` has `category` (`group_category` enum) and `is_official`, but no machine-readable "this is the canonical Music room" marker. Many official Groups already carry `category = 'music'` (Bedroom Pop, Drill, …), so category alone cannot identify a Medium Group.
- Link tables already exist and are keyed for idempotency: `group_works (group_id, work_id)`, `group_collabs (group_id, collab_post_id)`, `event_groups (event_id, group_id)`, `group_members (group_id, user_id)`.
- `group_events` has **no** creative category column (only `kind`), so Events need one small field.
- Blog↔Group already exists via `blog_post_entity_tags.group_id`. No new table needed for Blog.
- Publishing is done client-side against the tables (`works.new.tsx`, `me.edit.tsx`, collab/event flows insert directly). So the auto-linking must live in the **database**, not in React.

## Approach

All automatic linking is implemented as Postgres triggers plus SQL helper functions. That makes it server-side, unspoofable, idempotent, and reusable by the backfill. Client code changes are limited to the Event category field and small Group surfacing.

## Wave 1 — Foundation (schema only, no visible change)

- `groups`: add `system_type text` (`'medium'`) and `taxonomy_key text`, with a partial unique index on `taxonomy_key where system_type = 'medium'`. Business logic never matches on name or slug.
- Seed the five Medium Groups (`/g/music`, `/g/film-video`, `/g/writing`, `/g/visual-art`, `/g/games-tech`) with taglines like "Workshop community for people making music." Idempotent upsert by `taxonomy_key`. Architecture allows `performance`/`audio`/`design` later without more schema.
- Protect them: trigger blocking delete/soft-delete/slug or taxonomy_key change on system groups by non-admins.
- New table `group_membership_optouts (group_id, user_id, created_at)` — written when a user leaves a system Group; automatic membership always checks it first. Manual re-join clears it.
- `group_members`: add `source_type text default 'manual'` (`manual | profile | work | blog | collab | event`) for provenance. Manual join or a manual re-join upgrades the row to `manual`.
- Helper SQL functions: `medium_group_id(canonical text)`, `ensure_medium_membership(user, canonical)` (no-op if opted out), `link_entity_to_medium(...)` per entity type, and `canonical_from_storage(text)` mirroring `normalizeCategory` (film/visual/build/writing_book).
- TS side: `src/lib/medium-groups.ts` — `mediumGroupSlug()`, `mediumToCanonicalCategory()` (Photography/Ceramics/Painting/Illustration → visual_art; DJ/Songwriting/Production → music; Poetry/Journalism → writing; Code/Game design → games_tech; ambiguous ones left unmapped), with unit tests.
- Grants + RLS on the new table; system-group rows readable by all, opt-outs readable/writable only by their owner.

## Wave 2 — Works + Profiles

- Trigger on `works` insert/update when `status = 'published'` and visibility is public: link the Work into each Medium Group implied by `category` + `categories[]` (`group_works`), and ensure creator membership (`source_type = 'work'`). Manual group tags untouched.
- Category change on a published Work removes only *automatic* medium links that no longer apply (tracked by `group_works.added_by IS NULL` marker for system links) and adds new ones. Membership is not removed — content and membership are separate.
- Trigger on `profiles` update of `categories`/`mediums`: ensure membership for each canonical category, granular mediums mapped upward. Never removes membership.
- Backfill published Works and existing profiles (idempotent, no notifications).

## Wave 3 — Collabs + Blog

- Trigger on `collab_posts`: canonical category (skip `other`) → `group_collabs` link + creator membership. Manual tagging preserved.
- Trigger on `blog_posts` when published and `category_slug` maps to a canonical category (skip `general`): insert a `blog_post_entity_tags` row pointing at the Medium Group + author membership. Post is referenced, never duplicated.
- Group Today: add a small "Recent stories" item to the existing module rail reading those tags — no Today redesign.

## Wave 4 — Events

- `group_events`: add `creative_category text` validated against canonical work categories.
- Add a single optional "Creative category" select to the event create/edit form.
- Trigger: category → `event_groups` row for the Medium Group + creator membership. Host group row untouched; changing the category swaps only the automatic medium row. One Event, many Groups, no clones.

## Wave 5 — Polish + backfill

- Verify Medium Groups feel alive: Today rail, Works/Collabs/Events tabs, Groups index.
- Verify member-home / "From your groups" benefits with no duplicate cards; check empty states and mobile layout.
- Backfill Collabs, Blog posts, and Events deterministically; re-runnable, opt-out respecting.
- Subtle one-time toast on first automatic connection ("Added to Music"); nothing else.

## Security notes

Every automatic write happens in `SECURITY DEFINER` triggers keyed off ownership columns already on the row, so a client cannot fabricate memberships or content links. Soft-deleted groups, deleted/draft/private content, and account deletion cascade behavior are covered by existing FKs and the `deleted_at IS NULL` guards used elsewhere.

## Success checks

Publishing a Music Work links Work + creator to Music; a Visual Art blog post surfaces in Visual Art; a Film event appears in both its host Group and Film & Video with one row; leaving Music never silently re-adds you; user Groups behave exactly as before.
