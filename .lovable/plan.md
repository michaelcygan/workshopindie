## Goal

In the profile flow, drop Critique / Business of Art / Co-working from the medium selector (they remain in the wider Category enum for workshops/gallery/instant-rooms), expand the medium options with a curated set, and add a free-text "What you use" tools list.

## 1. Database (migration)

Add two new array columns to `profiles`:
- `mediums text[] not null default '{}'` — broader medium tags beyond the 5 publishable categories (e.g. `photography`, `printmaking`, `textiles`). Capped to 20 entries; each token validated against the curated id list via a trigger (drop unknown ids silently on insert/update so the list can evolve without breaking writes).
- `tools text[] not null default '{}'` — free-text. Cap 15 entries, 1–40 chars each, dedup case-insensitively via trigger.

Existing `categories` (Category enum array) stays as-is. It continues to drive Works tabs / gallery filters / Instant Workshops. The profile UI just narrows what it shows.

## 2. New curated medium list

Create `src/lib/mediums.ts`:

- `WORK_MEDIUMS` (these mirror the 5 publishable categories so editing them edits `categories` too):
  `film, music, writing, build, visual`
- `EXTRA_MEDIUMS` (new, stored in `mediums` text[]):
  `photography, printmaking, textiles, ceramics, sculpture, painting, illustration, design, fashion, jewelry, animation, comics, poetry, journalism, songwriting, production, dj, performance, dance, theater, sound-design, podcasting, game-design, code, photography-analog`
- Helper `mediumLabel(id)` and `ALL_PROFILE_MEDIUMS` (work + extra) for rendering.

Critique / Business of Art / Co-working are intentionally excluded — they stay in `src/lib/categories.ts` for workshop/instant contexts only.

## 3. `/me/edit` — Mediums & bio section (`src/routes/me.edit.tsx`)

Replace the current "What you make" chip row (which renders all 8 `CATEGORIES`) with a two-part picker:

- **Mediums** — single chip cloud combining `WORK_MEDIUMS` + `EXTRA_MEDIUMS`. Selecting a `WORK_MEDIUMS` chip toggles it in `form.cats` (Category enum, drives Works tabs). Selecting an `EXTRA_MEDIUMS` chip toggles it in `form.mediums` (new text[]). Visually identical — users don't need to know the split. Use the category color for the 5 work chips; neutral chip styling for extras.
  Helper copy: "Pick all that apply. Your work tabs come from Film, Music, Writing, Build, and Visual; the rest just describe your practice."
- **What you use (optional)** — free-text tag input below mediums. UI: existing chip list + an inline input that adds a chip on Enter or comma, X to remove. Cap 15. Helper copy: "Cameras, instruments, software, looms, kilns — whatever you work with."

Form state additions:
- `mediums: string[]` and `tools: string[]` in `FormState` and `EMPTY`.
- Hydrate from profile on load; persist trimmed + deduped on save.

## 4. Onboarding (`src/routes/onboarding.tsx`)

Mirror the same picker on the mediums step (work + extra chips combined; categories vs mediums written to their respective columns). Skip the tools picker in onboarding to keep that step short — users add tools later from `/me/edit`.

## 5. Public profile (`src/routes/u.$username.tsx`)

Select `mediums` and `tools` alongside `categories`. Render:
- Existing category chips remain on top.
- A muted "also works in" row of extra-medium chips when `mediums` is non-empty.
- A "Tools" line of small pill chips when `tools` is non-empty, below the bio.

## 6. Out of scope

- No changes to gallery filters, Workshop creation, Instant rooms, or the Category enum.
- No alias-style verification or search-by-medium.
- No tool standardization yet — free-text now, normalize later when we have data.
- No migration of existing `categories` values; users who had Critique/Business/Co-working selected keep them in `categories` (no longer exposed in the profile picker, but harmless).

## Technical notes

- One migration: add columns + a small `tg_profiles_mediums_tools_guard` trigger that trims, dedupes, caps, drops unknown medium ids, and enforces length on tools. No new RLS — both columns are part of the existing public profile read.
- `src/integrations/supabase/types.ts` will regenerate after the migration.
- All UI work stays in `src/lib/mediums.ts`, `src/routes/me.edit.tsx`, `src/routes/onboarding.tsx`, and `src/routes/u.$username.tsx`.
