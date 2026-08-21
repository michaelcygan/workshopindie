# Skills: multiple works + short description

Today each Skill points at exactly one Work and has only a label. This adds a short description and lets a Skill be demonstrated by several Works.

## What changes for members

**Edit profile → Skills**
- The add/edit dialog gains an optional description field, max 150 characters, with a live counter ("Trailer cutting for indie features and music docs.").
- The Work picker becomes multi-select: tap works to add or remove them, up to 5 per skill, with the chosen ones shown as a small ordered strip. At least one Work is still required — skills stay evidence-backed.
- Editor rows show the label, the description (one line, truncated), and a small stack of work thumbnails with a "+2" overflow marker.
- If some linked Works go private or are deleted, the row keeps the still-live ones and flags only the missing ones ("1 linked Work is no longer public"). A skill whose every Work is gone keeps today's relink/remove treatment.

**Public profile → Skills tab**
- Card leads with the skill label, then the description if present, then "Demonstrated in" followed by up to 3 work rows (thumbnail, title, Field · Category), with the rest behind a quiet "+2 more" that expands in place.
- A skill still only appears publicly when at least one linked Work is live, published, and public.

Unchanged: 10 skills max per profile, immediate save per action, no endorsements/levels/verification.

## Technical notes

**Migration**
- `profile_skills` gains `description text` with a length check of 150.
- New `public.profile_skill_works`: `skill_id` → `profile_skills(id)` ON DELETE CASCADE, `work_id` → `works(id)` ON DELETE CASCADE, `position int`, `created_at`, primary key `(skill_id, work_id)`, index on `(skill_id, position)`.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `SELECT` to `anon`, `ALL` to `service_role`. RLS on, with owner policies scoped through the parent skill's `profile_id` and a public SELECT policy mirroring the existing skill visibility rule (linked Work published + public).
- BEFORE INSERT trigger caps a skill at 5 Works, matching the existing cap-trigger pattern.
- Backfill: insert one row per existing `profile_skills.work_id` at position 0. `work_id` stays on the table as the primary/first Work so nothing breaks mid-deploy, and is kept in sync with position 0 by the server functions.

**Server** (`src/lib/skills/skills.server.ts`, `src/lib/skills.functions.ts`)
- `addSkill` / `updateSkill` accept `description` and `work_ids: string[]` (1–5). Every id runs through the existing `assertEligibleWork` check before write; `updateSkill` diffs the set and resequences positions.
- Description is trimmed, whitespace-collapsed, capped at 150 in a shared `cleanSkillDescription` in `src/lib/skills/normalize.ts` (alongside `SKILL_DESCRIPTION_MAX`, `MAX_SKILL_WORKS`), used by both the Zod schemas and the client.

**Client**
- `src/lib/skills/types.ts`: `Skill` gains `description: string | null` and `works: SkillWork[]`; `work` stays as a derived first-live-work getter so nothing else has to change at once.
- `src/hooks/use-skills.ts`: select joins `profile_skill_works(position, work:works(...))`, filters to live public Works, orders by position.
- `src/components/skills/skill-card.tsx`: renders description and the work list with the "+N more" expansion.
- `src/components/skills/skills-editor.tsx`: multi-select picker, description textarea with counter, thumbnail stack in rows.

**Tests** — Vitest for description normalization/cap, work-count cap, eligibility applied to every id in the set, position resequencing on update, and public filtering when some but not all Works go private.
