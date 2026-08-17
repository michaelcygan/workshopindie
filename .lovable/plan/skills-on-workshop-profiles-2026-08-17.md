# Skills on Workshop profiles

A Skill is a claim backed by evidence: **Person → demonstrates Skill through → Work**. Each Skill is a short member-authored label linked to exactly one Work they created or hold a visible credit on. Max 10 per profile, curated by hand.

## What members get

**In Edit Profile** (new "Skills" section between Fields & bio and Location & languages):

- "Show what you can do through work you've posted to Workshop."
- Add skill dialog: a text field (placeholder "Editing") with optional suggestion chips from their own Specialties, plus a filterable list of their eligible Works showing cover, title, and Field · Category. One Work must be chosen.
- Compact ordered rows: label, Work thumbnail, "Demonstrated in", Work title, and Edit / move up / move down / remove controls with accessible labels. Quiet `3/10` counter.
- Every action saves immediately — independent of the Save profile bar, exactly like Influences.
- No eligible Works: "Post a Work before adding a skill. Skills on Workshop are demonstrated through the work itself." plus a restrained Post to Gallery button. No unlinked Skills allowed.
- Linked Work gone private/unpublished/deleted: the row stays for the owner with "This Work is no longer public. Relink or remove this skill." and Relink / Remove actions.

**On the public profile** (`/$username`):

- New tab order: Works · Skills · Blog · Collabs · Influences · Activity · About.
- The Skills tab exists only when at least one Skill points to a live public published Work — for visitors and the owner alike. Zero valid Skills means no tab and no empty state.
- Skill cards lead with the label, then "Demonstrated in", then a Work thumbnail, title, and live Field · Category from the existing taxonomy helpers. Thumbnail links to `/works/$slug`. No counts, levels, endorsements, or "verified" language. Mobile: stacked rows; desktop: calm 1–2 column grid.

## Technical notes

**Migration** — `public.profile_skills`: `id`, `profile_id` → `profiles(id)` ON DELETE CASCADE, `label`, `normalized_label`, `work_id` → `works(id)` ON DELETE SET NULL, `position`, `created_at`, `updated_at`. Indexes on `(profile_id, position)` and `work_id`; unique `(profile_id, normalized_label)`; `work_id` deliberately not unique. GRANTs (`authenticated` full, `anon` SELECT, `service_role` all), RLS on. Owner policy `auth.uid() = profile_id` for all commands; public SELECT policy limited to rows whose Work exists and is `status = 'published'` with public visibility. A BEFORE INSERT trigger enforces the 10-row cap race-safely (same pattern as `enforce_profile_influences_cap`), plus an `updated_at` touch trigger.

**Normalization** — trim, collapse internal whitespace, cap at 60 chars, reject blank; `normalized_label` is the lowercased form. Lives in `src/lib/skills/normalize.ts` so it is unit-testable and shared by client and server.

**Server** — `src/lib/skills.functions.ts` (`addSkill`, `updateSkill`, `removeSkill`, `reorderSkills`, `listEligibleSkillWorks`), all `requireSupabaseAuth` + Zod validation, delegating via dynamic import to `src/lib/skills/skills.server.ts`. Eligibility check before any insert/relink: the Work must be published + public AND (`created_by = userId` OR a `work_credits` row for the user with `hidden_from_profile = false`). Friendly messages for duplicate label, cap reached, ineligible/unavailable Work. Reorder resequences positions.

**Eligible-Work query** — one reusable server function returning a deduplicated newest-first list of published public Works the member created *or* is visibly credited on (title, slug, cover, canonical field/category, published_at, credit role). The existing `me-owned-works` query in `me.edit.tsx` stays untouched since it is `created_by`-only and used by Pinned Works.

**Client** — `src/hooks/use-skills.ts` with distinct query keys for owner rows and public rows; a single Supabase select joining live Work data (no per-skill fetch). New `src/components/skills/skills-editor.tsx` and `src/components/skills/skill-card.tsx`. `me.edit.tsx` gains `skills` to `SectionId`/`SECTIONS`; `$username.tsx` gains `skills` in `TAB_VALUES`, the search-param enum, `counts`, `visibleTabs`, and tab rendering, keeping hook order stable.

**Tests** — Vitest for label normalization, case-insensitive duplicate keys, cap logic, and the eligibility predicate (creator-owned, visible credit, hidden credit rejected, unrelated Work rejected, non-public/unpublished rejected, one Work supporting several Skills, public filtering of invalid evidence, reorder resequencing).

Not in V1: endorsements, verification, levels, external evidence, multiple Works per Skill, skill pages/feeds/search, reverse display on Work pages, notifications, Plus gating, backfills, or seed data.
